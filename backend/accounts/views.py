import sentry_sdk
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import generics, permissions
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from beedero.ratelimit import enforce_rate_limit
from orgs.models import Activity, Visibility
from orgs.services import create_activity

from .models import InvestorProfile
from .serializers import (
    EmailTokenObtainPairSerializer,
    InvestorPostSerializer,
    InvestorProfileSerializer,
    MeSerializer,
    RegisterSerializer,
)
from .tokens import email_verification_token_generator

User = get_user_model()


def _client_ip(request):
    return request.META.get("REMOTE_ADDR")


def _send_verification_email(user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = email_verification_token_generator.make_token(user)
    verify_url = f"{settings.FRONTEND_URL}/verify-email?uid={uid}&token={token}"
    try:
        send_mail(
            "Verify your Beedero email",
            f"Confirm your email to publish your organization: {verify_url}",
            None,
            [user.email],
        )
    except Exception as exc:
        # Registration/resend itself still succeeds — the user account is
        # already created and shouldn't 500 over a mail provider hiccup —
        # but a silently undelivered verification email used to vanish
        # with no record anywhere. Now it's at least reported.
        sentry_sdk.capture_exception(exc)
    return verify_url


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def create(self, request, *args, **kwargs):
        enforce_rate_limit(f"register:{_client_ip(request)}", limit=10, window_seconds=3600)
        response = super().create(request, *args, **kwargs)
        user = User.objects.get(pk=response.data["id"])
        verify_url = _send_verification_email(user)
        if settings.DEBUG:
            response.data["verify_email_url"] = verify_url
        return response


class VerifyEmailConfirmView(APIView):
    """POST /api/auth/verify-email/confirm/ — uid+token from the emailed
    link. AllowAny: the token itself (not a session) is the credential,
    same pattern as password reset."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        uid = request.data.get("uid")
        token = request.data.get("token")
        try:
            user = User.objects.get(pk=force_str(urlsafe_base64_decode(uid)))
        except Exception:
            return Response({"detail": "Invalid verification link."}, status=400)

        if not email_verification_token_generator.check_token(user, token):
            return Response({"detail": "Invalid or expired verification link."}, status=400)

        if not user.is_email_verified:
            user.email_verified_at = timezone.now()
            user.save(update_fields=["email_verified_at"])
        return Response({"detail": "Email verified."})


class VerifyEmailResendView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        enforce_rate_limit(f"resend_verify:{request.user.id}", limit=5, window_seconds=3600)
        if request.user.is_email_verified:
            return Response({"detail": "Email already verified."})
        verify_url = _send_verification_email(request.user)
        response = {"detail": "Verification email sent."}
        if settings.DEBUG:
            response["verify_email_url"] = verify_url
        return Response(response)


class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        ip = _client_ip(request)
        email = str(request.data.get("email", "")).strip().lower()
        enforce_rate_limit(f"login:ip:{ip}", limit=20, window_seconds=3600)
        if email:
            # Guards a specific account against distributed brute force.
            enforce_rate_limit(f"login:email:{email}", limit=10, window_seconds=3600)
        return super().post(request, *args, **kwargs)


class ForgotPasswordView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        enforce_rate_limit(f"forgot:ip:{_client_ip(request)}", limit=10, window_seconds=3600)
        email = str(request.data.get("email", "")).strip().lower()
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        debug_reset_url = None
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_url = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"
            debug_reset_url = reset_url
            try:
                send_mail(
                    "Reset your Beedero password",
                    f"Use this link to reset your password: {reset_url}",
                    None,
                    [user.email],
                )
            except Exception as exc:
                # Must still return the same generic response either way —
                # letting this raise would 500 only when the account exists
                # and mail fails, leaking account existence via status code.
                sentry_sdk.capture_exception(exc)
        response = {"detail": "If an account exists, password reset instructions were sent."}
        if settings.DEBUG and debug_reset_url:
            response["reset_url"] = debug_reset_url
        # Always return the same response so account existence is not leaked.
        return Response(response)


class ResetPasswordView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        uid = request.data.get("uid")
        token = request.data.get("token")
        password = request.data.get("password")
        confirm_password = request.data.get("confirm_password")
        if password != confirm_password:
            return Response({"confirm_password": ["Passwords do not match."]}, status=400)

        try:
            user = User.objects.get(pk=force_str(urlsafe_base64_decode(uid)))
        except Exception:
            return Response({"detail": "Invalid password reset link."}, status=400)

        if not default_token_generator.check_token(user, token):
            return Response({"detail": "Invalid password reset link."}, status=400)

        try:
            validate_password(password, user=user)
        except Exception as exc:
            messages = getattr(exc, "messages", ["Password is not valid."])
            return Response({"password": list(messages)}, status=400)

        user.set_password(password)
        user.save(update_fields=["password"])
        return Response({"detail": "Password updated."})


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        refresh = request.data.get("refresh")
        if refresh:
            try:
                RefreshToken(refresh).blacklist()
            except TokenError:
                pass  # already invalid/expired/blacklisted — logout is idempotent
        return Response(status=204)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data)


INVESTOR_POST_KIND_MAP = {"milestone": "milestones", "event": "events", "update": "update"}


def _investor_activity_summary(activity):
    return {
        "id": activity.id,
        "kind": activity.kind,
        "title": activity.title,
        "body": activity.body,
        "image": activity.image.url if activity.image else None,
        "occurred_at": activity.occurred_at.isoformat(),
        "created_at": activity.created_at.isoformat(),
        "author_name": _investor_display_name(activity.author),
    }


def _investor_display_name(user):
    profile = getattr(user, "investorprofile", None)
    return (profile.full_name if profile and profile.full_name else None) or user.email


class InvestorPostListCreateView(APIView):
    """A verified investor's personal milestone/event/update posts, shown to
    their followers' feed (§Feed people). Persisted as an orgs.Activity —
    kept as a thin wrapper (plan §0) rather than merged with FeedPostView."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        activities = Activity.objects.filter(author=request.user, org__isnull=True).order_by(
            "-occurred_at"
        )
        return Response([_investor_activity_summary(a) for a in activities])

    def post(self, request):
        if Activity.objects.filter(
            author=request.user, org__isnull=True, created_at__date=timezone.localdate()
        ).exists():
            raise ValidationError({"detail": "This profile has already shared a post today."})
        serializer = InvestorPostSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        activity = create_activity(
            author=request.user,
            kind=INVESTOR_POST_KIND_MAP[data["kind"]],
            title=data["title"],
            body=data.get("body", ""),
            occurred_at=data["occurred_at"],
            image=data.get("image"),
            visibility=Visibility.PUBLIC,
        )
        return Response(_investor_activity_summary(activity), status=201)


class InvestorProfileView(APIView):
    """Creation/editing of one's own investor profile. Verification
    (is_verified) is manual at launch — only the verify_investor
    management command can turn it on (§8 item 3)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile, _ = InvestorProfile.objects.get_or_create(user=request.user)
        return Response(InvestorProfileSerializer(profile).data)

    def put(self, request):
        profile, _ = InvestorProfile.objects.get_or_create(user=request.user)
        serializer = InvestorProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
