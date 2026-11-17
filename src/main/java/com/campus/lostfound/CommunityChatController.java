package com.campus.lostfound;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/community-chat")
public class CommunityChatController {
    private final CommunityMessageRepository messages;
    private final UserAccountRepository users;
    private final NotificationService notificationService;
    private final ChatMessageReactionRepository reactions;

    public CommunityChatController(CommunityMessageRepository messages,
                                   UserAccountRepository users,
                                   NotificationService notificationService,
                                   ChatMessageReactionRepository reactions) {
        this.messages = messages;
        this.users = users;
        this.notificationService = notificationService;
        this.reactions = reactions;
    }

    @GetMapping
    public ResponseEntity<?> list(HttpServletRequest request) {
        if (!AuthController.isLoggedIn(request)) {
            return ResponseEntity.status(401).body(Map.of("message", "Please log in to use community chat."));
        }
        Long currentId = (Long) request.getSession(false).getAttribute(AuthController.SESSION_USER_ID);
        UserAccount currentAcc = users.findById(currentId).orElse(null);
        String current = currentAcc == null ? "" : currentAcc.getUsername();
        String userCollege = currentAcc == null ? "CU" : currentAcc.getCollege();
        List<CommunityMessage> source = messages.findTop200ByCollegeOrderByCreatedAtAsc(userCollege);
        if (source.isEmpty()) {
            source = messages.findTop200ByOrderByCreatedAtAsc().stream()
                    .filter(m -> m.getCollege() == null || m.getCollege().isBlank() || m.getCollege().equalsIgnoreCase(userCollege))
                    .toList();
        }

        List<Long> messageIds = source.stream().map(CommunityMessage::getId).toList();
        List<ChatMessageReaction> allReactions = messageIds.isEmpty() ? List.of() : reactions.findByMessageIdIn(messageIds);
        Map<Long, List<Map<String, Object>>> reactionsByMessage = new LinkedHashMap<>();
        for (ChatMessageReaction r : allReactions) {
            reactionsByMessage.computeIfAbsent(r.getMessageId(), k -> new java.util.ArrayList<>()).add(Map.of(
                    "id", r.getId(),
                    "username", r.getUsername(),
                    "displayName", r.getDisplayName() != null ? r.getDisplayName() : r.getUsername(),
                    "avatarId", r.getAvatarId() != null ? r.getAvatarId() : "",
                    "profileImageUrl", r.getProfileImageUrl() != null ? r.getProfileImageUrl() : "",
                    "college", r.getCollege() != null ? r.getCollege() : "CU",
                    "emoji", r.getEmoji(),
                    "createdAt", r.getCreatedAt().toString()
            ));
        }

        List<Map<String, Object>> result = source.stream().map(m -> {
            UserAccount author = users.findByUsernameKey(m.getUsername().toLowerCase(java.util.Locale.ROOT)).orElse(null);
            boolean isMine = m.getUsername().equalsIgnoreCase(current);
            boolean isAdmin = currentAcc != null && AuthController.canManageMembers(currentAcc);
            Map<String, Object> x = new LinkedHashMap<>();
            x.put("id", m.getId());
            x.put("username", m.getUsername());
            x.put("displayName", author == null ? m.getDisplayName() : author.getDisplayName());
            x.put("avatarId", author == null ? "" : author.getAvatarId());
            x.put("profileImageUrl", author == null || !AuthController.canUseCustomProfilePhoto(author) || author.getProfileImageData().isBlank() ? "" : "/api/users/" + org.springframework.web.util.UriUtils.encodePathSegment(author.getUsername(), java.nio.charset.StandardCharsets.UTF_8) + "/photo");
            x.put("role", author == null ? "MEMBER" : author.getRole());
            x.put("college", m.getCollege());
            x.put("message", m.getMessage());
            x.put("replyText", m.getReplyText());
            x.put("replyName", m.getReplyName());
            x.put("createdAt", m.getCreatedAt());
            x.put("mine", isMine);
            x.put("canDelete", isMine || isAdmin);
            x.put("reactions", reactionsByMessage.getOrDefault(m.getId(), List.of()));
            return x;
        }).toList();
        return ResponseEntity.ok()
                .header("Cache-Control", "no-cache, no-store, max-age=0, must-revalidate")
                .header("Pragma", "no-cache")
                .header("Expires", "0")
                .body(result);
    }

    @PostMapping
    public ResponseEntity<?> send(@RequestBody NewMessage body, HttpServletRequest request) {
        HttpSession s = request.getSession(false);
        if (s == null || !(s.getAttribute(AuthController.SESSION_USER_ID) instanceof Long id)) {
            return ResponseEntity.status(401).body(Map.of("message", "Please log in to send a message."));
        }
        String text = body == null || body.message() == null ? "" : body.message().trim();
        if (text.isEmpty()) return ResponseEntity.badRequest().body(Map.of("message", "Write a message first."));
        if (text.length() > 2000) return ResponseEntity.badRequest().body(Map.of("message", "Message must be 2000 characters or fewer."));
        UserAccount u = users.findById(id).orElse(null);
        if (u == null) return ResponseEntity.status(401).body(Map.of("message", "Please log in again."));
        if (u.isCommunityMuted()) return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Your account has been muted from community chat."));
        String replyText = body.replyText() == null ? null : body.replyText().trim();
        if (replyText != null && replyText.length() > 2000) replyText = replyText.substring(0, 2000);
        CommunityMessage saved = messages.save(new CommunityMessage(u.getUsername(), u.getDisplayName(), text, replyText, body.replyName(), u.getCollege()));
        notificationService.notifyCommunityMessage(u, saved);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", saved.getId()));
    }

    @PostMapping("/{id}/react")
    public ResponseEntity<?> react(@PathVariable Long id, @RequestBody Map<String, String> body, HttpServletRequest request) {
        if (!AuthController.isLoggedIn(request)) {
            return ResponseEntity.status(401).body(Map.of("message", "Please log in to react."));
        }
        Long currentId = (Long) request.getSession(false).getAttribute(AuthController.SESSION_USER_ID);
        UserAccount currentAcc = users.findById(currentId).orElse(null);
        if (currentAcc == null) {
            return ResponseEntity.status(401).body(Map.of("message", "Please log in again."));
        }
        CommunityMessage m = messages.findById(id).orElse(null);
        if (m == null) {
            return ResponseEntity.notFound().build();
        }
        String emoji = body != null && body.get("emoji") != null ? body.get("emoji").trim() : "";
        var existing = reactions.findByMessageIdAndUsername(id, currentAcc.getUsername());
        if (emoji.isBlank()) {
            existing.ifPresent(reactions::delete);
        } else if (existing.isPresent()) {
            ChatMessageReaction r = existing.get();
            if (r.getEmoji().equals(emoji)) {
                reactions.delete(r);
            } else {
                r.setEmoji(emoji);
                r.setCreatedAt(LocalDateTime.now());
                reactions.save(r);
            }
        } else {
            String profileUrl = !AuthController.canUseCustomProfilePhoto(currentAcc) || currentAcc.getProfileImageData().isBlank()
                    ? ""
                    : "/api/users/" + org.springframework.web.util.UriUtils.encodePathSegment(currentAcc.getUsername(), java.nio.charset.StandardCharsets.UTF_8) + "/photo";
            ChatMessageReaction newR = new ChatMessageReaction(
                    id,
                    currentAcc.getUsername(),
                    currentAcc.getDisplayName(),
                    currentAcc.getAvatarId(),
                    profileUrl,
                    currentAcc.getCollege(),
                    emoji
            );
            reactions.save(newR);
        }
        List<ChatMessageReaction> updated = reactions.findByMessageIdOrderByCreatedAtAsc(id);
        return ResponseEntity.ok()
                .header("Cache-Control", "no-cache, no-store, max-age=0, must-revalidate")
                .header("Pragma", "no-cache")
                .header("Expires", "0")
                .body(Map.of("success", true, "reactions", updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id, HttpServletRequest request) {
        HttpSession s = request.getSession(false);
        if (s == null || !(s.getAttribute(AuthController.SESSION_USER_ID) instanceof Long uid)) {
            return ResponseEntity.status(401).body(Map.of("message", "Please log in."));
        }
        CommunityMessage m = messages.findById(id).orElse(null);
        if (m == null) return ResponseEntity.notFound().build();
        UserAccount u = users.findById(uid).orElse(null);
        boolean isAuthor = u != null && m.getUsername().equalsIgnoreCase(u.getUsername());
        boolean isAdmin = u != null && AuthController.canManageMembers(u);
        if (!isAuthor && !isAdmin) return ResponseEntity.status(403).body(Map.of("message", "You can delete only your own messages."));
        reactions.deleteByMessageId(id);
        messages.delete(m);
        return ResponseEntity.ok(Map.of("deleted", true));
    }

    public record NewMessage(String message, String replyText, String replyName) {}
}
