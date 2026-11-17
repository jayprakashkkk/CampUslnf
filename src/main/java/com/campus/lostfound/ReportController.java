package com.campus.lostfound;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
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
    private final ItemClaimRepository itemClaims;

    public ReportController(ReportRepository repo,
                            UserAccountRepository users,
                            NotificationService notificationService,
                            PostLikeRepository postLikes,
                            PostCommentRepository postComments,
                            ItemClaimRepository itemClaims) {
        this.repo = repo;
        this.users = users;
        this.notificationService = notificationService;
        this.postLikes = postLikes;
        this.postComments = postComments;
        this.itemClaims = itemClaims;
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
                itemClaims.deleteByReportId(r.getId());
                repo.delete(r);
            }
        } catch (Exception ignored) {}
    }

    private void populateReportMeta(Report report, String currentUsername) {
        if (report == null) return;
        populateReportsMetaBatch(Collections.singletonList(report), currentUsername);
    }

    private void populateReportsMetaBatch(List<Report> reportList, String currentUsername) {
        if (reportList == null || reportList.isEmpty()) return;
        List<Long> reportIds = reportList.stream().map(Report::getId).filter(Objects::nonNull).toList();
        if (reportIds.isEmpty()) return;

        // 1. Batch likes
        List<PostLike> allLikes = postLikes.findByReportIdIn(reportIds);
        Map<Long, Long> likeCounts = allLikes.stream()
                .collect(Collectors.groupingBy(PostLike::getReportId, Collectors.counting()));
        Set<Long> myLikedReportIds = (currentUsername != null && !currentUsername.isBlank())
                ? allLikes.stream()
                    .filter(l -> l.getUsername().equalsIgnoreCase(currentUsername))
                    .map(PostLike::getReportId)
                    .collect(Collectors.toSet())
                : Collections.emptySet();

        // 2. Batch comments
        List<PostComment> allComments = postComments.findByReportIdIn(reportIds);
        Map<Long, Long> commentCounts = allComments.stream()
                .collect(Collectors.groupingBy(PostComment::getReportId, Collectors.counting()));

        // 3. Batch claims
        List<ItemClaim> allClaims = itemClaims.findByReportIdIn(reportIds);
        Map<Long, Long> claimCounts = allClaims.stream()
                .collect(Collectors.groupingBy(ItemClaim::getReportId, Collectors.counting()));

        // 4. Batch owners
        Set<String> ownerKeys = reportList.stream()
                .map(Report::getAccountUsername)
                .filter(u -> u != null && !u.isBlank())
                .map(u -> u.toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());
        Map<String, UserAccount> accountMap = ownerKeys.isEmpty()
                ? Collections.emptyMap()
                : users.findByUsernameKeyIn(ownerKeys).stream()
                    .collect(Collectors.toMap(UserAccount::getUsernameKey, a -> a, (a, b) -> a));

        LocalDateTime now = LocalDateTime.now();
        for (Report r : reportList) {
            String owner = r.getAccountUsername();
            if (owner != null && !owner.isBlank()) {
                UserAccount account = accountMap.get(owner.toLowerCase(Locale.ROOT));
                if (account != null) {
                    r.setOwnerDisplayName(account.getDisplayName());
                    r.setOwnerCourse(account.getCourse());
                    r.setOwnerAvatarId(account.getAvatarId());
                    r.setOwnerProfileImageUrl(!AuthController.canUseCustomProfilePhoto(account) || account.getProfileImageData().isBlank()
                            ? ""
                            : "/api/users/" + org.springframework.web.util.UriUtils.encodePathSegment(account.getUsername(), StandardCharsets.UTF_8) + "/photo");
                    r.setOwnerRole(account.getRole());
                } else {
                    r.setOwnerDisplayName(r.getReporterName());
                }
            } else {
                r.setOwnerDisplayName(r.getReporterName());
            }
            r.setLikeCount(likeCounts.getOrDefault(r.getId(), 0L));
            r.setCommentCount(commentCounts.getOrDefault(r.getId(), 0L));
            r.setClaimCount(claimCounts.getOrDefault(r.getId(), 0L));
            r.setLikedByMe(myLikedReportIds.contains(r.getId()));
            r.setImageUrl(r.getImageUrl());
            if (r.isDeleted() && r.getDeletedAt() != null) {
                long daysPassed = ChronoUnit.DAYS.between(r.getDeletedAt(), now);
                r.setDaysRemaining(Math.max(0, 30 - daysPassed));
            }
        }
    }

    @GetMapping
    public List<Report> all(HttpServletRequest request,
                            HttpServletResponse response,
                            @RequestParam(required = false) String type,
                            @RequestParam(required = false) String q,
                            @RequestParam(required = false, defaultValue = "false") boolean mine,
                            @RequestParam(required = false) Integer page,
                            @RequestParam(required = false) Integer size) {
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
                .filter(x -> !mine || (username != null && username.equalsIgnoreCase(x.getAccountUsername())))
                .sorted(Comparator.comparing(Report::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();

        int total = results.size();
        if (response != null) {
            response.setHeader("X-Total-Count", String.valueOf(total));
        }

        List<Report> slice;
        if (page != null) {
            int pageSize = (size != null && size > 0 && size <= 100) ? size : 20;
            int fromIndex = Math.max(0, page * pageSize);
            if (fromIndex >= total) {
                slice = Collections.emptyList();
            } else {
                int toIndex = Math.min(total, fromIndex + pageSize);
                slice = results.subList(fromIndex, toIndex);
            }
        } else {
            slice = results;
        }

        populateReportsMetaBatch(slice, username);
        return slice;
    }

    @GetMapping("/{id}/photo")
    public ResponseEntity<byte[]> getReportPhoto(@PathVariable Long id) {
        Report report = repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Report not found"));
        String data = report.getImageData();
        if (data == null || data.isBlank()) {
            return ResponseEntity.notFound().build();
        }
        String mime = "image/jpeg";
        String base64 = data;
        if (data.startsWith("data:") && data.contains(";base64,")) {
            int comma = data.indexOf(";base64,");
            mime = data.substring(5, comma);
            base64 = data.substring(comma + 8);
        }
        try {
            byte[] bytes = java.util.Base64.getDecoder().decode(base64.replaceAll("\\s+", ""));
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(mime))
                    .cacheControl(org.springframework.http.CacheControl.maxAge(30, java.util.concurrent.TimeUnit.DAYS).cachePublic())
                    .header("ETag", "\"report-img-" + id + "\"")
                    .body(bytes);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
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
        r.setSecretQuestion(r.getSecretQuestion() != null ? r.getSecretQuestion().trim() : null);
        Report saved = repo.save(r);
        users.findByUsernameKey(r.getAccountUsername().toLowerCase(java.util.Locale.ROOT))
                .ifPresent(actor -> notificationService.notifyReportCreated(saved, actor));

        // Auto-check for AI Smart Match >= 65% and alert matched owner
        try {
            List<Report> matches = getMatches(saved.getId(), request);
            if (!matches.isEmpty() && matches.get(0).getMatchScore() >= 65) {
                Report topMatch = matches.get(0);
                users.findByUsernameKey(topMatch.getAccountUsername().toLowerCase(Locale.ROOT)).ifPresent(matchedOwner -> {
                    notificationService.notifyGeneral(
                            matchedOwner.getId(),
                            "SMART_MATCH",
                            "AI Smart Match Found! 🤖",
                            "Someone just posted a " + saved.getType().toLowerCase() + " item (\"" + saved.getTitle() + "\") matching your report (" + topMatch.getMatchScore() + "% match)!",
                            saved.getAccountUsername(),
                            saved.getId()
                    );
                });
            }
        } catch (Exception ignored) {}

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
        String oldStatus = r.getStatus();
        r.setStatus(status);
        if ("RETURNED".equalsIgnoreCase(status) && !"RETURNED".equalsIgnoreCase(oldStatus)) {
            users.findByUsernameKey(r.getAccountUsername().toLowerCase(java.util.Locale.ROOT)).ifPresent(u -> {
                u.setKarmaPoints(u.getKarmaPoints() + 50);
                users.save(u);
            });
        }
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
        populateReportsMetaBatch(list, username);
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
        itemClaims.deleteByReportId(r.getId());
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
        populateReportsMetaBatch(list, username);
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
        List<Long> likedReportIds = likes.stream().map(PostLike::getReportId).filter(Objects::nonNull).toList();
        if (likedReportIds.isEmpty()) return Collections.emptyList();
        List<Report> reports = repo.findAllById(likedReportIds).stream()
                .filter(r -> !r.isDeleted() && !r.isArchived())
                .toList();
        populateReportsMetaBatch(reports, username);
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

    // --------------------------------------------------------------------------
    // AI SMART MATCHING
    // --------------------------------------------------------------------------
    @GetMapping("/{id}/matches")
    public List<Report> getMatches(@PathVariable Long id, HttpServletRequest request) {
        requireLogin(request);
        Report target = repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        String oppType = "LOST".equalsIgnoreCase(target.getType()) ? "FOUND" : "LOST";

        List<Report> candidates = repo.findAll().stream()
                .filter(r -> oppType.equalsIgnoreCase(r.getType()) && !r.isDeleted() && !r.isArchived() && !"RETURNED".equalsIgnoreCase(r.getStatus()))
                .filter(r -> target.getCollege() == null || r.getCollege() == null || target.getCollege().equalsIgnoreCase(r.getCollege()))
                .toList();

        List<Report> matches = new ArrayList<>();
        String targetText = (target.getTitle() + " " + target.getCategory() + " " + target.getLocation() + " " + (target.getDescription() != null ? target.getDescription() : "")).toLowerCase(Locale.ROOT);
        Set<String> targetTokens = tokenize(targetText);

        for (Report c : candidates) {
            int score = 0;
            // 1. Category match (+35%)
            if (target.getCategory() != null && target.getCategory().equalsIgnoreCase(c.getCategory())) {
                score += 35;
            }
            // 2. Text tokens overlap (up to +45%)
            String candText = (c.getTitle() + " " + c.getCategory() + " " + c.getLocation() + " " + (c.getDescription() != null ? c.getDescription() : "")).toLowerCase(Locale.ROOT);
            Set<String> candTokens = tokenize(candText);
            long common = targetTokens.stream().filter(candTokens::contains).count();
            if (!targetTokens.isEmpty()) {
                double overlapRatio = (double) common / Math.min(targetTokens.size(), candTokens.size());
                score += (int) (overlapRatio * 45);
            }
            // 3. Date proximity (up to +20%)
            if (target.getItemDate() != null && c.getItemDate() != null) {
                long days = Math.abs(ChronoUnit.DAYS.between(target.getItemDate(), c.getItemDate()));
                if (days <= 2) score += 20;
                else if (days <= 5) score += 12;
                else if (days <= 10) score += 6;
            } else {
                score += 10;
            }

            if (score >= 40) {
                populateReportMeta(c, AuthController.currentUsername(request));
                c.setMatchScore(Math.min(99, score));
                matches.add(c);
            }
        }

        matches.sort(Comparator.comparing(Report::getMatchScore, Comparator.reverseOrder()));
        return matches;
    }

    private Set<String> tokenize(String text) {
        if (text == null) return Collections.emptySet();
        return Arrays.stream(text.toLowerCase(Locale.ROOT).split("[\\s,.-]+"))
                .filter(w -> w.length() > 2 && !STOP_WORDS.contains(w))
                .collect(Collectors.toSet());
    }

    private static final Set<String> STOP_WORDS = Set.of("the", "and", "item", "lost", "found", "with", "for", "near", "from", "have", "please", "this", "that");

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
