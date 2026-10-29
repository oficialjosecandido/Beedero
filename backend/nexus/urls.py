from django.urls import path

from . import billing, newsletter, orgs, people, posts, reports, views

urlpatterns = [
    path("nexus/me/", views.MeView.as_view()),
    path("nexus/home/", views.HomeView.as_view()),
    path("nexus/overview/", views.OverviewView.as_view()),
    path("nexus/audit/", views.AuditView.as_view()),
    path("nexus/users/", people.UsersView.as_view()),
    path("nexus/users/<int:pk>/", people.UserView.as_view()),
    path("nexus/users/<int:pk>/<str:action>/", people.UserActionView.as_view()),
    path("nexus/orgs/", orgs.OrgsView.as_view()),
    path("nexus/orgs/<slug:slug>/", orgs.OrgView.as_view()),
    path("nexus/orgs/<slug:slug>/<str:action>/", orgs.OrgActionView.as_view()),
    path("nexus/posts/", posts.PostsView.as_view()),
    path("nexus/posts/<int:pk>/<str:action>/", posts.PostActionView.as_view()),
    path("nexus/reports/", reports.ReportsView.as_view()),
    path("nexus/reports/<int:pk>/resolve/", reports.ReportResolveView.as_view()),
    path("nexus/billing/", billing.BillingView.as_view()),
    path("nexus/billing/invoices/<int:pk>/issue/", billing.InvoiceIssueView.as_view()),
    path("nexus/billing/promo-codes/", billing.PromoCodesView.as_view()),
    path("nexus/billing/promo-codes/<str:code>/", billing.PromoCodeView.as_view()),
    path("nexus/newsletter/", newsletter.NewsletterView.as_view()),
    path("nexus/newsletter/contacts/", newsletter.ContactsView.as_view()),
    path("nexus/newsletter/contacts/<int:pk>/", newsletter.ContactView.as_view()),
    path("nexus/newsletter/<int:pk>/", newsletter.NewsletterSendView.as_view()),
    path("nexus/newsletter/<int:pk>/<str:action>/", newsletter.NewsletterActionView.as_view()),
]
