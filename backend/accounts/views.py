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
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import InvestorPost, InvestorProfile
from .serializers import (
    EmailTokenObtainPairSerializer,
    InvestorPostSerializer,
    InvestorProfileSerializer,
    MeSerializer,
    RegisterSerializer,
)

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []


class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer


class ForgotPasswordView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        email = str(request.data.get("email", "")).strip().lower()
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        debug_reset_url = None
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:3000")
            reset_url = f"{frontend_url}/reset-password?uid={uid}&token={token}"
            debug_reset_url = reset_url
            try:
                send_mail(
                    "Reset your Beedero password",
                    f"Use this link to reset your password: {reset_url}",
                    None,
                    [user.email],
                    fail_silently=True,
                )
            except Exception:
                pass
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


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data)


class InvestorPostListCreateView(generics.ListCreateAPIView):
    """A verified investor's personal milestone/event/update posts, shown to
    their followers' feed (§Feed people)."""

    serializer_class = InvestorPostSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return InvestorPost.objects.filter(author=self.request.user)

    def perform_create(self, serializer):
        if InvestorPost.objects.filter(
            author=self.request.user,
            created_at__date=timezone.localdate(),
        ).exists():
            raise ValidationError({"detail": "This profile has already shared a post today."})
        serializer.save(author=self.request.user)


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
