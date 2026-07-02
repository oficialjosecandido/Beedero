from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import InvestorProfile
from .serializers import InvestorProfileSerializer, MeSerializer, RegisterSerializer


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data)


class InvestorProfileView(APIView):
    """Creation/editing of one's own investor profile. Verification
    (is_verified) is manual at launch — only the verify_investor
    management command can turn it on (§8 item 3)."""

    permission_classes = [permissions.IsAuthenticated]

    def put(self, request):
        profile, _ = InvestorProfile.objects.get_or_create(user=request.user)
        serializer = InvestorProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
