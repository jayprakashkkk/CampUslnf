package com.campus.lostfound;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

public interface ChatMessageReactionRepository extends JpaRepository<ChatMessageReaction, Long> {
    List<ChatMessageReaction> findByMessageIdOrderByCreatedAtAsc(Long messageId);
    List<ChatMessageReaction> findByMessageIdIn(Collection<Long> messageIds);
    Optional<ChatMessageReaction> findByMessageIdAndUsername(Long messageId, String username);
    @Transactional
    void deleteByMessageIdAndUsername(Long messageId, String username);
    @Transactional
    void deleteByMessageId(Long messageId);
}
