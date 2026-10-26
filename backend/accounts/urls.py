from django.urls import path

from . import badges, linkedin_views, onboarding_views, public_views, signin_link, views

urlpatterns = [
    path("profile/import/linkedin/preview/", linkedin_views.LinkedInImportPreviewView.as_view()),
    path("profile/import/linkedin/apply/", linkedin_views.LinkedInImportApplyView.as_view()),
    path("auth/signin-link/", signin_link.SignInLinkView.as_view()),
    path("auth/signin-code/verify/", signin_link.SignInCodeVerifyView.as_view()),
    path("auth/me/", views.MeView.as_view()),
    path("me/badges/", badges.BadgeCountsView.as_view()),
    path("onboarding/", onboarding_views.OnboardingView.as_view()),
    path("onboarding/intents/", onboarding_views.OnboardingIntentOptionsView.as_view()),
    path("onboarding/suggestions/", onboarding_views.OnboardingSuggestionsView.as_view()),
    path("investors/me/", views.InvestorProfileView.as_view()),
    path("investors/me/posts/", views.InvestorPostListCreateView.as_view()),
    path("investors/me/stats/", views.InvestorStatsView.as_view()),
    path("investors/me/insight/", views.PersonInsightView.as_view()),
    path("investors/me/vitality/", views.InvestorVitalityView.as_view()),
    path("investors/me/badge-embed/", views.InvestorBadgeEmbedView.as_view()),
    path("experience/", views.SelfDeclaredExperienceListCreateView.as_view()),
    path("experience/<int:experience_id>/", views.SelfDeclaredExperienceDetailView.as_view()),
    path("people/search/", views.PeopleSearchView.as_view()),
    path("public/people/<slug:handle>/", public_views.PublicPersonProfileView.as_view()),
    path("public/pbadge/<slug:handle>/svg/", public_views.PublicPersonBadgeSvgView.as_view()),
    path("public/pbadge/<slug:handle>/json/", public_views.PublicPersonBadgeJsonView.as_view()),
]
