package com.campus.lostfound;

import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/reports")
public class ReportController {
    private final ReportRepository repo;
    private final UserAccountRepository users;
    private final NotificationService notificationService;
    private final PostLikeRepository postLikes;
    private final PostCommentRepository postComments;

    public ReportController(ReportRepository repo,
                            UserAccountRepository users,
                            NotificationService notificationService,
                            PostLikeRepository postLikes,
                            PostCommentRepository postComments) {
        this.repo = repo;
        this.users = users;
        this.notificationService = notificationService;
        this.postLikes = postLikes;
        this.postComments = postComments;
    }

    /**
     * Purge any soft-deleted reports older than 30 days.
     */
    private void cleanupExpiredDeletedReports() {
        try {
            LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);
            List<Report> expired = repo.findAll().stream()
                    .filter(r -> r.isDeleted() && r.getDeletedAt() != null && r.getDeletedAt().isBefore(thirtyDaysAgo))
                    .toList();
            for (Report r : expired) {
                postLikes.deleteByReportId(r.getId());
                postComments.deleteByReportId(r.getId());
                repo.delete(r);
            }
        } catch (Exception ignored) {}
    }

    private void populateReportMeta(Report report, String currentUsername) {
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
        report.setLikeCount(postLikes.countByReportId(report.getId()));
        report.setCommentCount(postComments.countByReportId(report.getId()));
        if (currentUsername != null && !currentUsername.isBlank()) {
            report.setLikedByMe(postLikes.existsByReportIdAndUsername(report.getId(), currentUsername));
        } else {
            report.setLikedByMe(false);
        }
        if (report.isDeleted() && report.getDeletedAt() != null) {
            long daysPassed = ChronoUnit.DAYS.between(report.getDeletedAt(), LocalDateTime.now());
            report.setDaysRemaining(Math.max(0, 30 - daysPassed));
        }
    }

    @GetMapping
    public List<Report> all(HttpServletRequest request,
                            @RequestParam(required = false) String type,
                            @RequestParam(required = false) String q,
                            @RequestParam(required = false, defaultValue = "false") boolean mine) {
        requireLogin(request);
        cleanupExpiredDeletedReports();

        String username = AuthController.currentUsername(request);
        UserAccount currentAcc = currentUser(request);
        String userCollege = currentAcc == null ? "CU" : currentAcc.getCollege();

        List<Report> results = repo.findAll().stream()
                .filter(x -> !x.isArchived() && !x.isDeleted())
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
            populateReportMeta(report, username);
        }
        return results;
    }

    @GetMapping("/{id}")
    public Report getById(@PathVariable Long id, HttpServletRequest request) {
        requireLogin(request);
        Report report = repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Report not found"));
        populateReportMeta(report, AuthController.currentUsername(request));
        return report;
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
        r.setArchived(false);
        r.setDeleted(false);
        r.setAccountUsername(AuthController.currentUsername(request));
        UserAccount currentAcc = currentUser(request);
        r.setCollege(currentAcc == null ? "CU" : currentAcc.getCollege());
        Report saved = repo.save(r);
        users.findByUsernameKey(r.getAccountUsername().toLowerCase(java.util.Locale.ROOT))
                .ifPresent(actor -> notificationService.notifyReportCreated(saved, actor));
        populateReportMeta(saved, r.getAccountUsername());
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
        Report saved = repo.save(r);
        populateReportMeta(saved, currentUser);
        return saved;
    }

    // --------------------------------------------------------------------------
    // ARCHIVE & UNARCHIVE
    // --------------------------------------------------------------------------
    @PostMapping("/{id}/archive")
    public Report archiveReport(@PathVariable Long id, HttpServletRequest request) {
        requireLogin(request);
        Report r = repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        String username = AuthController.currentUsername(request);
        UserAccount user = currentUser(request);
        boolean isOwner = username != null && r.getAccountUsername() != null && username.equalsIgnoreCase(r.getAccountUsername());
        boolean isPrivileged = user != null && List.of("OWNER", "ADMIN").contains(user.getRole());
        if (!isOwner && !isPrivileged) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot archive this report.");
        }
        r.setArchived(true);
        r.setArchivedAt(LocalDateTime.now());
        Report saved = repo.save(r);
        populateReportMeta(saved, username);
        return saved;
    }

    @PostMapping("/{id}/unarchive")
    public Report unarchiveReport(@PathVariable Long id, HttpServletRequest request) {
        requireLogin(request);
        Report r = repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        String username = AuthController.currentUsername(request);
        UserAccount user = currentUser(request);
        boolean isOwner = username != null && r.getAccountUsername() != null && username.equalsIgnoreCase(r.getAccountUsername());
        boolean isPrivileged = user != null && List.of("OWNER", "ADMIN").contains(user.getRole());
        if (!isOwner && !isPrivileged) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot unarchive this report.");
        }
        r.setArchived(false);
        r.setArchivedAt(null);
        Report saved = repo.save(r);
        populateReportMeta(saved, username);
        return saved;
    }

    @GetMapping("/archived")
    public List<Report> getArchivedReports(HttpServletRequest request) {
        requireLogin(request);
        String username = AuthController.currentUsername(request);
        List<Report> list = repo.findAll().stream()
                .filter(r -> r.isArchived() && !r.isDeleted())
                .filter(r -> username != null && username.equalsIgnoreCase(r.getAccountUsername()))
                .sorted(Comparator.comparing(Report::getArchivedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
        for (Report r : list) {
            populateReportMeta(r, username);
        }
        return list;
    }

    // --------------------------------------------------------------------------
    // SOFT DELETE, RESTORE & PERMANENT DELETE (30-DAY RETENTION)
    // --------------------------------------------------------------------------
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> softDelete(@PathVariable Long id, HttpServletRequest request) {
        requireLogin(request);
        Report r = repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        String username = AuthController.currentUsername(request);
        UserAccount user = currentUser(request);
        boolean isOwner = username != null && r.getAccountUsername() != null && username.equalsIgnoreCase(r.getAccountUsername());
        boolean isPrivileged = user != null && List.of("OWNER", "ADMIN").contains(user.getRole());
        if (!isOwner && !isPrivileged) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot delete this report.");
        }
        r.setDeleted(true);
        r.setDeletedAt(LocalDateTime.now());
        repo.save(r);
        return ResponseEntity.ok(Map.of(
                "message", "Report moved to Recently Deleted. You have 30 days to restore it.",
                "deleted", true,
                "daysRemaining", 30
        ));
    }

    @PostMapping("/{id}/restore")
    public Report restoreReport(@PathVariable Long id, HttpServletRequest request) {
        requireLogin(request);
        Report r = repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        String username = AuthController.currentUsername(request);
        UserAccount user = currentUser(request);
        boolean isOwner = username != null && r.getAccountUsername() != null && username.equalsIgnoreCase(r.getAccountUsername());
        boolean isPrivileged = user != null && List.of("OWNER", "ADMIN").contains(user.getRole());
        if (!isOwner && !isPrivileged) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot restore this report.");
        }
        r.setDeleted(false);
        r.setDeletedAt(null);
        Report saved = repo.save(r);
        populateReportMeta(saved, username);
        return saved;
    }

    @DeleteMapping("/{id}/permanent")
    public ResponseEntity<Void> permanentDelete(@PathVariable Long id, HttpServletRequest request) {
        requireLogin(request);
        Report r = repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        String username = AuthController.currentUsername(request);
        UserAccount user = currentUser(request);
        boolean isOwner = username != null && r.getAccountUsername() != null && username.equalsIgnoreCase(r.getAccountUsername());
        boolean isPrivileged = user != null && List.of("OWNER", "ADMIN").contains(user.getRole());
        if (!isOwner && !isPrivileged) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot delete this report.");
        }
        postLikes.deleteByReportId(r.getId());
        postComments.deleteByReportId(r.getId());
        repo.delete(r);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/deleted")
    public List<Report> getDeletedReports(HttpServletRequest request) {
        requireLogin(request);
        cleanupExpiredDeletedReports();
        String username = AuthController.currentUsername(request);
        List<Report> list = repo.findAll().stream()
                .filter(Report::isDeleted)
                .filter(r -> username != null && username.equalsIgnoreCase(r.getAccountUsername()))
                .sorted(Comparator.comparing(Report::getDeletedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
        for (Report r : list) {
            populateReportMeta(r, username);
        }
        return list;
    }

    // --------------------------------------------------------------------------
    // LIKES
    // --------------------------------------------------------------------------
    @PostMapping("/{id}/like")
    public Map<String, Object> toggleLike(@PathVariable Long id, HttpServletRequest request) {
        requireLogin(request);
        Report r = repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        String username = AuthController.currentUsername(request);
        boolean alreadyLiked = postLikes.existsByReportIdAndUsername(id, username);
        if (alreadyLiked) {
            postLikes.deleteByReportIdAndUsername(id, username);
        } else {
            postLikes.save(new PostLike(id, username));
        }
        long count = postLikes.countByReportId(id);
        return Map.of("liked", !alreadyLiked, "count", count);
    }

    @GetMapping("/liked")
    public List<Report> getLikedReports(HttpServletRequest request) {
        requireLogin(request);
        String username = AuthController.currentUsername(request);
        List<PostLike> likes = postLikes.findByUsernameOrderByCreatedAtDesc(username);
        List<Report> reports = new ArrayList<>();
        for (PostLike pl : likes) {
            repo.findById(pl.getReportId()).ifPresent(report -> {
                if (!report.isDeleted() && !report.isArchived()) {
                    populateReportMeta(report, username);
                    reports.add(report);
                }
            });
        }
        return reports;
    }

    // --------------------------------------------------------------------------
    // COMMENTS & REPLIES
    // --------------------------------------------------------------------------
    @GetMapping("/{id}/comments")
    public List<PostComment> getComments(@PathVariable Long id, HttpServletRequest request) {
        requireLogin(request);
        List<PostComment> all = postComments.findByReportIdOrderByCreatedAtAsc(id);

        // Decorate with user info
        for (PostComment c : all) {
            users.findByUsernameKey(c.getUsername().toLowerCase(java.util.Locale.ROOT)).ifPresent(account -> {
                c.setUserDisplayName(account.getDisplayName());
                c.setUserAvatarId(account.getAvatarId());
                c.setUserProfileImageUrl(!AuthController.canUseCustomProfilePhoto(account) || account.getProfileImageData().isBlank() ? "" : "/api/users/" + org.springframework.web.util.UriUtils.encodePathSegment(account.getUsername(), java.nio.charset.StandardCharsets.UTF_8) + "/photo");
                c.setUserRole(account.getRole());
            });
        }

        // Organize top-level comments and nested replies
        Map<Long, PostComment> topMap = new LinkedHashMap<>();
        List<PostComment> orphanReplies = new ArrayList<>();

        for (PostComment c : all) {
            if (c.getParentCommentId() == null) {
                topMap.put(c.getId(), c);
            } else {
                orphanReplies.add(c);
            }
        }

        for (PostComment reply : orphanReplies) {
            PostComment parent = topMap.get(reply.getParentCommentId());
            if (parent != null) {
                parent.getReplies().add(reply);
            } else {
                // If direct parent is also a reply, find top-level ancestor or add to root
                boolean nested = false;
                for (PostComment root : topMap.values()) {
                    for (PostComment sub : root.getReplies()) {
                        if (sub.getId().equals(reply.getParentCommentId())) {
                            root.getReplies().add(reply);
                            nested = true;
                            break;
                        }
                    }
                    if (nested) break;
                }
                if (!nested) {
                    topMap.put(reply.getId(), reply);
                }
            }
        }

        return new ArrayList<>(topMap.values());
    }

    @PostMapping("/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public PostComment addComment(@PathVariable Long id, @RequestBody Map<String, Object> body, HttpServletRequest request) {
        requireLogin(request);
        Report report = repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        String content = body.getOrDefault("content", "").toString().trim();
        if (content.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Comment cannot be empty.");
        }
        if (content.length() > 1000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Comment cannot exceed 1000 characters.");
        }

        PostComment comment = new PostComment();
        comment.setReportId(id);
        comment.setUsername(AuthController.currentUsername(request));
        comment.setContent(content);

        if (body.get("parentCommentId") != null) {
            try {
                comment.setParentCommentId(Long.valueOf(body.get("parentCommentId").toString()));
            } catch (Exception ignored) {}
        }
        if (body.get("replyToUsername") != null) {
            comment.setReplyToUsername(body.get("replyToUsername").toString().trim().replaceFirst("^@", ""));
        }

        PostComment saved = postComments.save(comment);

        users.findByUsernameKey(saved.getUsername().toLowerCase(java.util.Locale.ROOT)).ifPresent(account -> {
            saved.setUserDisplayName(account.getDisplayName());
            saved.setUserAvatarId(account.getAvatarId());
            saved.setUserProfileImageUrl(!AuthController.canUseCustomProfilePhoto(account) || account.getProfileImageData().isBlank() ? "" : "/api/users/" + org.springframework.web.util.UriUtils.encodePathSegment(account.getUsername(), java.nio.charset.StandardCharsets.UTF_8) + "/photo");
            saved.setUserRole(account.getRole());
        });

        return saved;
    }

    @DeleteMapping("/{id}/comments/{commentId}")
    public ResponseEntity<Void> deleteComment(@PathVariable Long id, @PathVariable Long commentId, HttpServletRequest request) {
        requireLogin(request);
        PostComment comment = postComments.findById(commentId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        Report report = repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        String username = AuthController.currentUsername(request);
        UserAccount user = currentUser(request);
        boolean isCommentAuthor = username != null && username.equalsIgnoreCase(comment.getUsername());
        boolean isReportOwner = username != null && report.getAccountUsername() != null && username.equalsIgnoreCase(report.getAccountUsername());
        boolean isPrivileged = user != null && List.of("OWNER", "ADMIN").contains(user.getRole());

        if (!isCommentAuthor && !isReportOwner && !isPrivileged) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot delete this comment.");
        }

        postComments.delete(comment);
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
