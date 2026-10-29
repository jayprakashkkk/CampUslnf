package com.campus.lostfound;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CampusNotificationRepository extends JpaRepository<CampusNotification, Long> {
    List<CampusNotification> findTop50ByRecipientUserIdOrderByIdDesc(Long recipientUserId);
    long countByRecipientUserIdAndReadFlagFalse(Long recipientUserId);

    @Modifying
    @Query("update CampusNotification n set n.readFlag = true where n.recipientUserId = :userId and n.readFlag = false")
    int markAllRead(@Param("userId") Long userId);
}
