import sentry_sdk
from django.conf import settings
from django.contrib import messages
from django.core.exceptions import ValidationError
from django.core.mail import EmailMultiAlternatives
from django.core.validators import validate_email
from django.shortcuts import redirect, render
from django.utils.html import strip_tags
from django.views.decorators.http import require_POST

from accounts.models import User
from beedero.admin_access import kpi_admin_required

from .models import NewsletterRecipient, NewsletterSend

TEST_EMAIL_RECIPIENT = "josevcandido@gmail.com"


def _send_one(subject, html_content, to_email):
    message = EmailMultiAlternatives(
        subject, strip_tags(html_content), settings.DEFAULT_FROM_EMAIL, [to_email]
    )
    message.attach_alternative(html_content, "text/html")
    message.send()


@kpi_admin_required
def newsletter_view(request):
    recipients = NewsletterRecipient.objects.all()
    return render(
        request,
        "admin/newsletter.html",
        {
            "title": "Newsletter",
            "recipients": recipients,
            "recipients_count": recipients.count(),
            "users_count": User.objects.filter(is_active=True).exclude(email="").count(),
            "history": NewsletterSend.objects.select_related("sent_by")[:20],
            "test_email": TEST_EMAIL_RECIPIENT,
        },
    )


@kpi_admin_required
@require_POST
def newsletter_send_test(request):
    subject = request.POST.get("subject", "").strip()
    html_content = request.POST.get("html_content", "").strip()
    if not subject or not html_content:
        messages.error(request, "Preenche o assunto e o conteúdo HTML antes de enviar o teste.")
        return redirect("admin-newsletter")

    try:
        _send_one(f"[TESTE] {subject}", html_content, TEST_EMAIL_RECIPIENT)
    except Exception as exc:
        sentry_sdk.capture_exception(exc)
        messages.error(request, f"Falha ao enviar o email de teste: {exc}")
    else:
        messages.success(request, f"Email de teste enviado para {TEST_EMAIL_RECIPIENT}.")
    return redirect("admin-newsletter")


@kpi_admin_required
@require_POST
def newsletter_send(request):
    subject = request.POST.get("subject", "").strip()
    html_content = request.POST.get("html_content", "").strip()
    audience = request.POST.get("audience", "")

    if not subject or not html_content or audience not in NewsletterSend.Audience.values:
        messages.error(request, "Preenche o assunto, o conteúdo HTML e escolhe o público.")
        return redirect("admin-newsletter")

    emails = set()
    if audience in (NewsletterSend.Audience.USERS, NewsletterSend.Audience.BOTH):
        emails.update(User.objects.filter(is_active=True).exclude(email="").values_list("email", flat=True))
    if audience in (NewsletterSend.Audience.RECIPIENTS, NewsletterSend.Audience.BOTH):
        emails.update(NewsletterRecipient.objects.values_list("email", flat=True))

    sent = failed = 0
    for email in emails:
        try:
            _send_one(subject, html_content, email)
            sent += 1
        except Exception as exc:
            failed += 1
            sentry_sdk.capture_exception(exc)

    NewsletterSend.objects.create(
        subject=subject,
        html_content=html_content,
        audience=audience,
        recipient_count=sent,
        failed_count=failed,
        sent_by=request.user,
    )
    messages.success(request, f"Newsletter enviada: {sent} com sucesso, {failed} falha(s).")
    return redirect("admin-newsletter")


@kpi_admin_required
@require_POST
def newsletter_recipients_add(request):
    raw = request.POST.get("emails", "")
    added = skipped = 0
    for line in raw.splitlines():
        email = line.strip().lower()
        if not email:
            continue
        try:
            validate_email(email)
        except ValidationError:
            skipped += 1
            continue
        _, created = NewsletterRecipient.objects.get_or_create(email=email)
        added += int(created)

    messages.success(request, f"{added} email(s) adicionados. {skipped} inválido(s) ignorados.")
    return redirect("admin-newsletter")


@kpi_admin_required
@require_POST
def newsletter_recipient_delete(request, pk):
    NewsletterRecipient.objects.filter(pk=pk).delete()
    messages.success(request, "Contacto removido.")
    return redirect("admin-newsletter")
