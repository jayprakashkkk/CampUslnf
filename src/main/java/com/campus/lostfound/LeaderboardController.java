package com.campus.lostfound;

import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriUtils;

@RestController
public class LeaderboardController {

    private final UserAccountRepository users;

    public LeaderboardController(UserAccountRepository users) {
        this.users = users;
    }

    @GetMapping({"/api/leaderboard", "/api/users/leaderboard"})
    public ResponseEntity<?> getLeaderboard() {
        List<UserAccount> top = users.findAll().stream()
                .sorted(Comparator.comparing(UserAccount::getKarmaPoints, Comparator.reverseOrder()))
                .limit(10)
                .toList();

        List<Map<String, Object>> list = new ArrayList<>();
        int rank = 1;
        for (UserAccount u : top) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("rank", rank++);
            m.put("username", u.getUsername());
            m.put("displayName", u.getDisplayName());
            m.put("college", u.getCollege());
            m.put("course", u.getCourse());
            m.put("avatarId", u.getAvatarId());
            m.put("profileImageUrl", !AuthController.canUseCustomProfilePhoto(u) || u.getProfileImageData().isBlank() ? "" : "/api/users/" + UriUtils.encodePathSegment(u.getUsername(), StandardCharsets.UTF_8) + "/photo");
            m.put("karmaPoints", u.getKarmaPoints());
            m.put("karmaBadge", u.getKarmaBadge());
            m.put("role", u.getRole());
            list.add(m);
        }
        return ResponseEntity.ok(list);
    }
}
