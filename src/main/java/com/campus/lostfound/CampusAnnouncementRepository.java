package com.campus.lostfound;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CampusAnnouncementRepository extends JpaRepository<CampusAnnouncement, Long> {
    List<CampusAnnouncement> findByActiveTrueOrderByCreatedAtDesc();
    List<CampusAnnouncement> findAllByOrderByCreatedAtDesc();
}
