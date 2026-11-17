package com.campus.lostfound;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

public class PasswordHasherTest {

    @Test
    public void testHashAndVerify() {
        PasswordHasher hasher = new PasswordHasher();
        String plain = "campusSecret123!";
        String hash = hasher.hash(plain);
        assertNotNull(hash);
        assertTrue(hash.startsWith("pbkdf2$310000$"));

        assertTrue(hasher.matches(plain, hash));
        assertFalse(hasher.matches("wrongPassword", hash));
    }
}
