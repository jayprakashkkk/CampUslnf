package com.campus.lostfound;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
    private final CampusNotificationRepository notifications;
    private final UserAccountRepository users;

    public NotificationController(CampusNotificationRepository notifications, UserAccountRepository users) {
        this.notifications = notifications;
        this.users = users;
    }

    @GetMapping
    public ResponseEntity<?> list(HttpServletRequest request) {
        UserAccount account = currentAccount(request);
        if (account == null) return unauthorized();
        List<Map<String, Object>> items = notifications.findTop50ByRecipientUserIdOrderByIdDesc(account.getId())
                .stream().map(n -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", n.getId());
                    item.put("type", n.getType());
                    item.put("title", n.getTitle());
                    item.put("message", n.getMessage());
                    item.put("actorUsername", n.getActorUsername());
                    item.put("actorDisplayName", n.getActorDisplayName());
                    item.put("relatedReportId", n.getRelatedReportId());
                    item.put("createdAt", n.getCreatedAt());
                    item.put("read", n.isReadFlag());
                    return item;
                }).toList();
        return ResponseEntity.ok(Map.of(
                "notifications", items,
                "unreadCount", notifications.countByRecipientUserIdAndReadFlagFalse(account.getId()),
                "communityMuted", account.isCommunityMuted()));
    }

    @PostMapping("/{id}/read")
    @Transactional
    public ResponseEntity<?> markRead(@PathVariable Long id, HttpServletRequest request) {
        UserAccount account = currentAccount(request);
        if (account == null) return unauthorized();
        CampusNotification notification = notifications.findById(id).orElse(null);
        if (notification == null || !notification.getRecipientUserId().equals(account.getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Notification not found."));
        }
        notification.setReadFlag(true);
        notifications.save(notification);
        return ResponseEntity.ok(Map.of("read", true));
    }

    @PostMapping("/read-all")
    @Transactional
    public ResponseEntity<?> markAllRead(HttpServletRequest request) {
        UserAccount account = currentAccount(request);
        if (account == null) return unauthorized();
        notifications.markAllRead(account.getId());
        return ResponseEntity.ok(Map.of("readAll", true));
    }

    @PostMapping("/community-mute")
    @Transactional
    public ResponseEntity<?> setCommunityMuted(@RequestBody MuteRequest body, HttpServletRequest request) {
        UserAccount account = currentAccount(request);
        if (account == null) return unauthorized();
        boolean muted = body != null && body.muted();
        account.setCommunityMuted(muted);
        users.save(account);
        return ResponseEntity.ok(Map.of("communityMuted", muted));
    }

    private UserAccount currentAccount(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null || !(session.getAttribute(AuthController.SESSION_USER_ID) instanceof Long id)) return null;
        return users.findById(id).orElse(null);
    }

    private ResponseEntity<Map<String, String>> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Please log in to continue."));
    }

    public record MuteRequest(boolean muted) {}
}
