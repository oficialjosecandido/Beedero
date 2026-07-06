from django.contrib.auth.tokens import PasswordResetTokenGenerator


class EmailVerificationTokenGenerator(PasswordResetTokenGenerator):
    """Same signed-timestamp mechanism as the password reset token, but keyed
    off email_verified_at instead of the password hash — so a token is
    invalidated by being used (email_verified_at changes), not by a
    password change."""

    def _make_hash_value(self, user, timestamp):
        return f"{user.pk}{user.email}{user.email_verified_at}{timestamp}"


email_verification_token_generator = EmailVerificationTokenGenerator()
