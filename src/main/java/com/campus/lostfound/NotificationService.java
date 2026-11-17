package com.campus.lostfound;

import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationService {
    private final CampusNotificationRepository notifications;
    private final UserAccountRepository users;

    public NotificationService(CampusNotificationRepository notifications, UserAccountRepository users) {
        this.notifications = notifications;
        this.users = users;
    }

    /** Every newly-created Lost/Found report notifies the other registered accounts. */
    @Transactional
    public void notifyReportCreated(Report report, UserAccount actor) {
        if (report == null || actor == null || actor.getId() == null) return;
        boolean lost = "LOST".equalsIgnoreCase(report.getType());
        String type = lost ? "REPORT_LOST" : "REPORT_FOUND";
        String title = lost ? "New lost item posted" : "New found item posted";
        String message = actor.getDisplayName() + (lost ? " reported a lost item: " : " found an item: ") + safe(report.getTitle(), 220);
        List<CampusNotification> batch = new ArrayList<>();
        for (UserAccount recipient : users.findAll()) {
            if (recipient.getId() == null || recipient.getId().equals(actor.getId())) continue;
            if (!recipient.getCollege().equalsIgnoreCase(actor.getCollege())) continue;
            // Item-post notifications are independent of the community-chat mute setting.
            batch.add(new CampusNotification(recipient.getId(), type, title, message,
                    actor.getUsername(), actor.getDisplayName(), report.getId()));
        }
        if (!batch.isEmpty()) notifications.saveAll(batch);
    }

    /** Chat notices honor each recipient's personal community mute preference. */
    @Transactional
    public void notifyCommunityMessage(UserAccount actor, CommunityMessage chatMessage) {
        if (actor == null || actor.getId() == null || chatMessage == null) return;
        String snippet = safe(chatMessage.getMessage(), 90);
        List<CampusNotification> batch = new ArrayList<>();
        for (UserAccount recipient : users.findAll()) {
            if (recipient.getId() == null || recipient.getId().equals(actor.getId()) || recipient.isChatNotificationsMuted()) continue;
            if (!recipient.getCollege().equalsIgnoreCase(actor.getCollege())) continue;
            batch.add(new CampusNotification(recipient.getId(), "CHAT", "New community message",
                    actor.getDisplayName() + ": " + snippet, actor.getUsername(), actor.getDisplayName(), null));
        }
        if (!batch.isEmpty()) notifications.saveAll(batch);
    }

    @Transactional
    public void notifyGeneral(Long recipientId, String type, String title, String message, String actorUsername, Long reportId) {
        if (recipientId == null) return;
        notifications.save(new CampusNotification(recipientId, type, title, message, actorUsername, actorUsername, reportId));
    }

    private String safe(String value, int max) {
        String clean = value == null ? "an item" : value.trim();
        if (clean.length() > max) return clean.substring(0, max - 1) + "…";
        return clean;
    }
}
