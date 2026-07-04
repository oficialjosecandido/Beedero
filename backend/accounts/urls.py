from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    path("auth/register/", views.RegisterView.as_view()),
    path("auth/token/", views.EmailTokenObtainPairView.as_view()),
    path("auth/forgot-password/", views.ForgotPasswordView.as_view()),
    path("auth/reset-password/", views.ResetPasswordView.as_view()),
    path("auth/token/refresh/", TokenRefreshView.as_view()),
    path("auth/me/", views.MeView.as_view()),
    path("investors/me/", views.InvestorProfileView.as_view()),
    path("investors/me/posts/", views.InvestorPostListCreateView.as_view()),
]
