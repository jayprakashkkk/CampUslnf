# CampUs Password Reset Setup (Railway Deployment)

## Railway Environment Variables
Configure these in Railway > Your CampUs Service > **Variables**. Do not commit credentials to GitHub.

- `MAIL_HOST` = `smtp.gmail.com`
- `MAIL_PORT` = `587`
- `MAIL_USERNAME` = The Gmail address used to send reset emails
- `MAIL_PASSWORD` = Google App Password (not your personal Gmail password)
- `RESET_OTP_MINUTES` = `10` (optional)

### How to get a Google App Password:
1. Go to your Google Account > Security.
2. Enable 2-Step Verification if not already enabled.
3. Search for "App Passwords" (or go to Security > 2-Step Verification > App passwords).
4. Create a new App Password named "CampUs".
5. Copy the 16-character code and set it as `MAIL_PASSWORD` in Railway Variables.

After setting variables, Railway automatically redeploys. If email sending fails, check Railway deploy logs and verify the Gmail App Password.

## Included Features
- Login form has a complete Forgot Password flow (request OTP, enter 6-digit OTP, set new password).
- Backend stores only salted PBKDF2 hash of OTP, expires it, and limits verification attempts to 5.
- Unified back button handling and responsive mobile dialogs.

## Test Checklist
1. Register or use an existing account with an email you can access.
2. Open "Forgot password?" from the login screen and request an OTP.
3. Confirm the email arrives, enter the 6-digit code, and set a new password (min 8 characters).
4. Log in with the new password.
