from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AdvisorProfile
from .serializers import AdvisorProfileSerializer


class AdvisorProfileView(APIView):
    """GET/PUT /api/advisory/me/ — self-declared advisory/board preferences."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile, _ = AdvisorProfile.objects.get_or_create(user=request.user)
        return Response(AdvisorProfileSerializer(profile).data)

    def put(self, request):
        profile, _ = AdvisorProfile.objects.get_or_create(user=request.user)
        serializer = AdvisorProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
