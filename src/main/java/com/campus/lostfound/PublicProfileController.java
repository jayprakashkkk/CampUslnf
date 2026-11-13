package com.campus.lostfound;

import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.http.CacheControl;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.concurrent.TimeUnit;
import org.springframework.web.util.UriUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public, read-only profile information shown from chat avatars and report authors. */
@RestController
@RequestMapping("/api/users")
public class PublicProfileController {
    private final UserAccountRepository users;
    private final ReportRepository reports;

    public PublicProfileController(UserAccountRepository users, ReportRepository reports) {
        this.users = users;
        this.reports = reports;
    }

    /** Search member usernames for the global CampusFind search bar. */
    @GetMapping("/search")
    public ResponseEntity<?> searchMembers(@RequestParam(name = "q", required = false, defaultValue = "") String query,
                                           HttpServletRequest request) {
        if (!AuthController.isLoggedIn(request)) {
            return error(HttpStatus.UNAUTHORIZED, "Please log in to search CampusFind members.");
        }
        String needle = query == null ? "" : query.trim().toLowerCase(Locale.ROOT).replaceFirst("^@", "");
        if (needle.isBlank()) return ResponseEntity.ok(Map.of("members", List.of()));
        List<UserAccount> found = users.findAll().stream()
                .filter(account -> account.getUsername() != null
                        && account.getUsername().toLowerCase(Locale.ROOT).contains(needle))
                .sorted(Comparator.comparingInt((UserAccount account) ->
                                account.getUsername().toLowerCase(Locale.ROOT).startsWith(needle) ? 0 : 1)
                        .thenComparing(UserAccount::getUsername, String.CASE_INSENSITIVE_ORDER))
                .limit(10)
                .toList();
        List<Map<String, Object>> matches = new ArrayList<>();
        for (UserAccount account : found) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("username", account.getUsername());
            row.put("displayName", account.getDisplayName());
            row.put("course", account.getCourse());
            row.put("college", account.getCollege());
            row.put("collegeName", AuthController.collegeDisplayName(account.getCollege()));
            row.put("role", account.getRole());
            row.put("avatarId", account.getAvatarId());
            row.put("profileImageUrl", AuthController.canUseCustomProfilePhoto(account)
                    && !account.getProfileImageData().isBlank() ? imageUrl(account.getUsername(), "photo") : "");
            matches.add(row);
        }
        return ResponseEntity.ok(Map.of("members", matches));
    }

    @GetMapping("/{username}/profile")
    public ResponseEntity<Map<String, Object>> profile(@PathVariable String username, HttpServletRequest request) {
        if (!AuthController.isLoggedIn(request)) {
            return error(HttpStatus.UNAUTHORIZED, "Please log in to view member profiles.");
        }
        String key = username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
        UserAccount account = users.findByUsernameKey(key).orElse(null);
        if (account == null) {
            return error(HttpStatus.NOT_FOUND, "This profile could not be found.");
        }

        List<Report> owned = reports.findAll().stream()
                .filter(report -> report.getAccountUsername() != null
                        && report.getAccountUsername().equalsIgnoreCase(account.getUsername()))
                .sorted(Comparator.comparing(Report::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();

        List<Map<String, Object>> posts = new ArrayList<>();
        for (Report report : owned) {
            Map<String, Object> post = new LinkedHashMap<>();
            post.put("id", report.getId());
            post.put("type", report.getType());
            post.put("title", report.getTitle());
            post.put("category", report.getCategory());
            post.put("location", report.getLocation());
            post.put("status", report.getStatus());
            post.put("itemDate", report.getItemDate());
            post.put("createdAt", report.getCreatedAt());
            post.put("description", report.getDescription() == null ? "" : report.getDescription());
            post.put("imageData", report.getImageData());
            posts.add(post);
        }

        long receivedBack = owned.stream().filter(r -> "LOST".equalsIgnoreCase(r.getType())
                && "RETURNED".equalsIgnoreCase(r.getStatus())).count();
        long returnedToOthers = owned.stream().filter(r -> "FOUND".equalsIgnoreCase(r.getType())
                && "RETURNED".equalsIgnoreCase(r.getStatus())).count();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("username", account.getUsername());
        result.put("displayName", account.getDisplayName());
        result.put("course", account.getCourse());
        result.put("college", account.getCollege());
        result.put("collegeName", AuthController.collegeDisplayName(account.getCollege()));
        result.put("avatarInitial", firstInitial(account.getDisplayName()));
        result.put("avatarId", account.getAvatarId());
        result.put("profileImageUrl", !AuthController.canUseCustomProfilePhoto(account) || account.getProfileImageData().isBlank() ? "" : imageUrl(account.getUsername(), "photo"));
        result.put("bannerImageUrl", !AuthController.canUseProfileBanner(account) || account.getBannerImageData().isBlank() ? "" : imageUrl(account.getUsername(), "banner"));
        result.put("role", account.getRole());
        UserAccount viewer = sessionUser(request);
        result.put("viewerRole", viewer == null ? "MEMBER" : viewer.getRole());
        result.put("viewerUsername", viewer == null ? "" : viewer.getUsername());
        result.put("bannerAllowed", AuthController.canUseProfileBanner(account));
        result.put("totalPosts", owned.size());
        result.put("itemsReceivedBack", receivedBack);
        result.put("itemsReturnedToOthers", returnedToOthers);
        result.put("posts", posts);
        return ResponseEntity.ok(result);
    }



    @GetMapping(value = "/{username}/photo")
    public ResponseEntity<byte[]> profilePhoto(@PathVariable String username, HttpServletRequest request) {
        return profileImage(username, request, false);
    }

    @GetMapping(value = "/{username}/banner")
    public ResponseEntity<byte[]> profileBanner(@PathVariable String username, HttpServletRequest request) {
        return profileImage(username, request, true);
    }

    private ResponseEntity<byte[]> profileImage(String username, HttpServletRequest request, boolean banner) {
        if (!AuthController.isLoggedIn(request)) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        String key = username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
        UserAccount account = users.findByUsernameKey(key).orElse(null);
        if (account == null) return ResponseEntity.notFound().build();
        if (banner && !AuthController.canUseProfileBanner(account)) return ResponseEntity.notFound().build();
        if (!banner && !AuthController.canUseCustomProfilePhoto(account)) return ResponseEntity.notFound().build();
        String data = banner ? account.getBannerImageData() : account.getProfileImageData();
        if (data == null || data.isBlank()) return ResponseEntity.notFound().build();
        int comma = data.indexOf(',');
        int semicolon = data.indexOf(';');
        if (!data.startsWith("data:image/") || comma < 0 || semicolon < 0 || semicolon > comma) return ResponseEntity.notFound().build();
        String mime = data.substring(5, semicolon);
        if (!List.of("image/jpeg", "image/png", "image/webp").contains(mime)) return ResponseEntity.notFound().build();
        try {
            byte[] imageBytes = Base64.getDecoder().decode(data.substring(comma + 1));
            return ResponseEntity.ok().contentType(MediaType.parseMediaType(mime))
                    .cacheControl(CacheControl.noCache())
                    .body(imageBytes);
        } catch (IllegalArgumentException invalid) {
            return ResponseEntity.notFound().build();
        }
    }

    private String imageUrl(String username, String kind) {
        return "/api/users/" + UriUtils.encodePathSegment(username, StandardCharsets.UTF_8) + "/" + kind;
    }

    /** Owner/Admin member directory; available role changes are enforced server-side. */
    @GetMapping("/manage")
    public ResponseEntity<?> manageMembers(HttpServletRequest request) {
        UserAccount actor = sessionUser(request);
        if (actor == null) return error(HttpStatus.UNAUTHORIZED, "Please log in.");
        if (!AuthController.canManageMembers(actor)) return error(HttpStatus.FORBIDDEN, "Only the Owner or Admin can manage member roles.");
        List<Map<String, Object>> members = users.findAll().stream()
                .sorted(Comparator.comparing(UserAccount::getUsername, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .map(account -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("username", account.getUsername());
                    row.put("displayName", account.getDisplayName());
                    row.put("course", account.getCourse());
            row.put("college", account.getCollege());
            row.put("collegeName", AuthController.collegeDisplayName(account.getCollege()));
                    row.put("role", account.getRole());
                    return row;
                }).toList();
        return ResponseEntity.ok(Map.of("members", members));
    }

    @org.springframework.web.bind.annotation.PostMapping("/{username}/role")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> updateMemberRole(@PathVariable String username,
            @org.springframework.web.bind.annotation.RequestBody RoleUpdate update, HttpServletRequest request) {
        UserAccount actor = sessionUser(request);
        if (actor == null) return error(HttpStatus.UNAUTHORIZED, "Please log in.");
        String actorRole = actor.getRole();
        if (!AuthController.canManageMembers(actor)) return error(HttpStatus.FORBIDDEN, "Only the Owner or Admin can manage member roles.");
        String targetUsername = username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
        UserAccount target = users.findByUsernameKey(targetUsername).orElse(null);
        if (target == null) return error(HttpStatus.NOT_FOUND, "Member not found.");
        if ("OWNER".equals(actorRole) && target.getId().equals(actor.getId())) return error(HttpStatus.FORBIDDEN, "You cannot change your own Owner role here.");
        if ("ADMIN".equals(actorRole) && "OWNER".equals(target.getRole())) return error(HttpStatus.FORBIDDEN, "Admins cannot change the Owner's role.");
        if ("ADMIN".equals(actorRole) && "ADMIN".equals(target.getRole())) return error(HttpStatus.FORBIDDEN, "Admins cannot change another Admin's role.");
        String requested = update == null || update.role() == null ? "" : update.role().trim().toUpperCase(Locale.ROOT);
        List<String> allowedRoles = "OWNER".equals(actorRole)
                ? List.of("OWNER", "ADMIN", "LEADER", "MODERATOR", "MEMBER")
                : List.of("LEADER", "MODERATOR", "MEMBER");
        if (!allowedRoles.contains(requested)) {
            return error(HttpStatus.FORBIDDEN, "Your role cannot assign that role. Choose one of: " + String.join(", ", allowedRoles) + ".");
        }
        target.setRole(requested);
        if (!AuthController.canUseCustomProfilePhoto(target)) target.setProfileImageData(null);
        if (!AuthController.canUseProfileBanner(target)) target.setBannerImageData(null);
        users.saveAndFlush(target);
        return ResponseEntity.ok(Map.of("username", target.getUsername(), "role", target.getRole(), "message", "Member role updated."));
    }

    private UserAccount sessionUser(HttpServletRequest request) {
        if (!AuthController.isLoggedIn(request)) return null;
        Object id = request.getSession(false).getAttribute(AuthController.SESSION_USER_ID);
        return id instanceof Long userId ? users.findById(userId).orElse(null) : null;
    }

    public record RoleUpdate(String role) {}

    private ResponseEntity<Map<String, Object>> error(HttpStatus status, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", message);
        return ResponseEntity.status(status).body(body);
    }

    private String firstInitial(String name) {
        String clean = name == null ? "" : name.trim();
        return clean.isEmpty() ? "?" : clean.substring(0, 1).toUpperCase(Locale.ROOT);
    }
}
