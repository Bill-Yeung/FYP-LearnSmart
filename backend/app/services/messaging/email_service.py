import logging
import smtplib
import asyncio
from concurrent.futures import ThreadPoolExecutor
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings

logger = logging.getLogger(__name__)

_smtp_executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix="smtp")

class EmailService:

    def __init__(self):
        self.provider = settings.email_provider
        self.from_email = settings.email_from_email or settings.smtp_username
        self.from_name = settings.email_from_name
        self.smtp_host = settings.smtp_host
        self.smtp_port = settings.smtp_port
        self.smtp_username = settings.smtp_username
        self.smtp_password = settings.smtp_password

    async def _send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: str) -> bool:
       
        if self.provider == "console":
            logger.info(f"""
            ====================================
            EMAIL (Console Mode)
            ====================================
            To: {to_email}
            Subject: {subject}

            {text_body}
            ====================================
            """)
            return True

        if self.provider == "smtp":
            if self.smtp_port == 465 and (not self.smtp_username or not self.smtp_password):
                logger.error("SMTP credentials not configured for direct SSL connection")
                return False

            def send_smtp():
                try:

                    message = MIMEMultipart("alternative")
                    message["From"] = f"{self.from_name} <{self.from_email}>"
                    message["To"] = to_email
                    message["Subject"] = subject

                    part1 = MIMEText(text_body, "plain")
                    part2 = MIMEText(html_body, "html")
                    message.attach(part1)
                    message.attach(part2)

                    if self.smtp_port == 465:
                        with smtplib.SMTP_SSL(self.smtp_host, self.smtp_port, timeout=30) as server:
                            server.login(self.smtp_username, self.smtp_password)
                            server.send_message(message)
                    else:
                        with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=30) as server:
                            server.send_message(message)

                    logger.info(f"Email sent successfully to {to_email} via Gmail SMTP")
                    return True

                except smtplib.SMTPAuthenticationError:
                    logger.error(f"SMTP authentication failed for {self.smtp_username}")
                    return False
                except smtplib.SMTPException as e:
                    logger.error(f"SMTP error sending email to {to_email}: {str(e)}")
                    return False
                except Exception as e:
                    logger.error(f"Unexpected error sending email to {to_email}: {str(e)}")
                    return False

            loop = asyncio.get_event_loop()
            try:
                return await loop.run_in_executor(_smtp_executor, send_smtp)
            except Exception as e:
                logger.error(f"Failed to send email in executor: {str(e)}")
                return False

        logger.error(f"Unknown email provider: {self.provider}")
        return False

    async def send_otp_email(self, email: str, otp: str, username: str) -> bool:
        
        subject = "Password Reset Request - Learning Platform"

        text_body = f"""
Hi {username},

You requested to reset your password for your Learning Platform account.

Your One-Time Password (OTP) is:

    {otp}

This code will expire in 15 minutes.

If you didn't request this password reset, please ignore this email.
Your password will remain unchanged.

Best regards,
Learning Platform Team
        """.strip()

        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }}
        .content {{ background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }}
        .otp-code {{ background-color: #fff; border: 2px dashed #4F46E5; padding: 15px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; color: #4F46E5; }}
        .warning {{ color: #666; font-size: 14px; margin-top: 20px; }}
        .footer {{ text-align: center; margin-top: 20px; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Password Reset Request</h1>
        </div>
        <div class="content">
            <p>Hi <strong>{username}</strong>,</p>
            <p>You requested to reset your password for your Learning Platform account.</p>
            <p>Your One-Time Password (OTP) is:</p>
            <div class="otp-code">{otp}</div>
            <p class="warning">This code will expire in <strong>15 minutes</strong>.</p>
            <p class="warning">If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
        </div>
        <div class="footer">
            <p>Best regards,<br>Learning Platform Team</p>
        </div>
    </div>
</body>
</html>
        """.strip()

        return await self._send_email(email, subject, html_body, text_body)

    async def send_password_changed_notification(self, email: str, username: str) -> bool:
        
        subject = "Password Changed Successfully - Learning Platform"

        text_body = f"""
Hi {username},

Your password for Learning Platform was changed successfully.

If you made this change, you can safely ignore this email.

If you did NOT make this change, please contact our support team immediately
at support@learningplatform.com or reset your password again.

Best regards,
Learning Platform Team
        """.strip()

        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #10B981; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }}
        .content {{ background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }}
        .success {{ background-color: #D1FAE5; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0; }}
        .warning {{ background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; }}
        .footer {{ text-align: center; margin-top: 20px; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Password Changed</h1>
        </div>
        <div class="content">
            <p>Hi <strong>{username}</strong>,</p>
            <div class="success">
                <p><strong>Your password was changed successfully.</strong></p>
            </div>
            <p>If you made this change, you can safely ignore this email.</p>
            <div class="warning">
                <p><strong>Didn't make this change?</strong></p>
                <p>Please contact our support team immediately at <strong>support@learningplatform.com</strong> or reset your password again.</p>
            </div>
        </div>
        <div class="footer">
            <p>Best regards,<br>Learning Platform Team</p>
        </div>
    </div>
</body>
</html>
        """.strip()

        return await self._send_email(email, subject, html_body, text_body)

    async def send_email_change_otp(self, to_email: str, otp: str) -> bool:

        subject = "Confirm your new email address - Learning Platform"

        text_body = f"""
Hi,

You requested to change the email address on your Learning Platform account.

Your One-Time Password (OTP) to confirm this new address is:

    {otp}

This code will expire in 10 minutes.

If you didn't request this change, you can safely ignore this email.
Your existing email will remain unchanged.

Best regards,
Learning Platform Team
        """.strip()

        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }}
        .content {{ background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }}
        .otp-code {{ background-color: #fff; border: 2px dashed #4F46E5; padding: 15px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; color: #4F46E5; }}
        .warning {{ color: #666; font-size: 14px; margin-top: 20px; }}
        .footer {{ text-align: center; margin-top: 20px; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Confirm Your New Email</h1>
        </div>
        <div class="content">
            <p>Hi,</p>
            <p>You requested to change the email address on your Learning Platform account.</p>
            <p>Your One-Time Password (OTP) to confirm this new address is:</p>
            <div class="otp-code">{otp}</div>
            <p class="warning">This code will expire in <strong>10 minutes</strong>.</p>
            <p class="warning">If you didn't request this change, you can safely ignore this email. Your existing email will remain unchanged.</p>
        </div>
        <div class="footer">
            <p>Best regards,<br>Learning Platform Team</p>
        </div>
    </div>
</body>
</html>
        """.strip()

        return await self._send_email(to_email, subject, html_body, text_body)

# Singleton instance
email_service = EmailService()
