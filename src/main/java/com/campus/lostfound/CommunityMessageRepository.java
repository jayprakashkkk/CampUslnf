package com.campus.lostfound;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
public interface CommunityMessageRepository extends JpaRepository<CommunityMessage, Long> {
    List<CommunityMessage> findTop200ByOrderByCreatedAtAsc();
}
