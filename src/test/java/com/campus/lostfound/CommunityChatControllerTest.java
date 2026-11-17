package com.campus.lostfound;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class CommunityChatControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserAccountRepository users;

    @Autowired
    private CommunityMessageRepository messages;

    @Autowired
    private ChatMessageReactionRepository reactions;

    @Autowired
    private ObjectMapper objectMapper;

    private MockHttpSession session;
    private UserAccount testUser;

    @BeforeEach
    public void setup() {
        reactions.deleteAll();
        messages.deleteAll();

        testUser = users.findByUsernameKey("chattester").orElseGet(() -> {
            UserAccount u = new UserAccount();
            u.setUsername("chattester");
            u.setUsernameKey("chattester");
            u.setEmail("tester@cgc.edu.in");
            u.setEmailKey("tester@cgc.edu.in");
            u.setPasswordHash("hash123");
            u.setDisplayName("Chat Tester");
            u.setCourse("BCA");
            u.setCollege("CGC_UNIV");
            return users.save(u);
        });

        session = new MockHttpSession();
        session.setAttribute(AuthController.SESSION_USER_ID, testUser.getId());
        session.setAttribute(AuthController.SESSION_USERNAME, testUser.getUsername());
        session.setAttribute(AuthController.SESSION_DISPLAY_NAME, testUser.getDisplayName());
    }

    @Test
    public void testChatSendAndPersistentReactions() throws Exception {
        // 1. Send chat message
        String sendJson = objectMapper.writeValueAsString(Map.of("message", "Hello campus test!"));
        MvcResult sendResult = mockMvc.perform(post("/api/community-chat")
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(sendJson))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andReturn();

        Map<?, ?> resp = objectMapper.readValue(sendResult.getResponse().getContentAsString(), Map.class);
        Long messageId = ((Number) resp.get("id")).longValue();

        // 2. React with heart emoji
        String reactJson = objectMapper.writeValueAsString(Map.of("emoji", "❤️"));
        mockMvc.perform(post("/api/community-chat/" + messageId + "/react")
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reactJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.reactions[0].emoji").value("❤️"))
                .andExpect(jsonPath("$.reactions[0].username").value(testUser.getUsername()));

        // 3. Verify reaction appears in general GET list for other users
        mockMvc.perform(get("/api/community-chat").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(messageId))
                .andExpect(jsonPath("$[0].reactions[0].emoji").value("❤️"));

        // 4. Toggle reaction (same emoji removes it)
        mockMvc.perform(post("/api/community-chat/" + messageId + "/react")
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reactJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reactions").isEmpty());

        // 5. Delete chat message
        mockMvc.perform(delete("/api/community-chat/" + messageId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deleted").value(true));
    }
}
