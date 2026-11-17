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

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class ReportControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserAccountRepository users;

    @Autowired
    private ReportRepository reports;

    @Autowired
    private PostLikeRepository postLikes;

    @Autowired
    private ObjectMapper objectMapper;

    private MockHttpSession session;
    private UserAccount testUser;

    @BeforeEach
    public void setup() {
        postLikes.deleteAll();
        reports.deleteAll();

        testUser = users.findByUsernameKey("reporttester").orElseGet(() -> {
            UserAccount u = new UserAccount();
            u.setUsername("reporttester");
            u.setUsernameKey("reporttester");
            u.setEmail("rep@cgc.edu.in");
            u.setEmailKey("rep@cgc.edu.in");
            u.setPasswordHash("hash123");
            u.setDisplayName("Report Tester");
            u.setCourse("BCA");
            u.setCollege("CU");
            return users.save(u);
        });

        session = new MockHttpSession();
        session.setAttribute(AuthController.SESSION_USER_ID, testUser.getId());
        session.setAttribute(AuthController.SESSION_USERNAME, testUser.getUsername());
        session.setAttribute(AuthController.SESSION_DISPLAY_NAME, testUser.getDisplayName());
    }

    @Test
    public void testReportCreateLikeAndPagination() throws Exception {
        // 1. Create a Report
        Report r = new Report();
        r.setType("LOST");
        r.setTitle("Blue Water Bottle");
        r.setCategory("Bottles");
        r.setLocation("Library 2nd Floor");
        r.setReporterName("Report Tester");
        r.setDescription("Milton insulated stainless steel blue bottle");

        MvcResult createResult = mockMvc.perform(post("/api/reports")
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(r)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.title").value("Blue Water Bottle"))
                .andReturn();

        Map<?, ?> resp = objectMapper.readValue(createResult.getResponse().getContentAsString(), Map.class);
        Long reportId = ((Number) resp.get("id")).longValue();

        // 2. Toggle Like
        mockMvc.perform(post("/api/reports/" + reportId + "/like")
                        .session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.liked").value(true))
                .andExpect(jsonPath("$.count").value(1));

        // 3. Test Paginated Fetch with X-Total-Count header and batch metadata decoration
        mockMvc.perform(get("/api/reports?page=0&size=10")
                        .session(session))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Total-Count", "1"))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].likeCount").value(1))
                .andExpect(jsonPath("$[0].likedByMe").value(true));
    }
}
