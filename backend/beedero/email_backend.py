from azure.communication.email import EmailClient
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend


class AzureCommunicationEmailBackend(BaseEmailBackend):
    """Sends Django EmailMessages through Azure Communication Services Email.

    Used in production, where django.core.mail's default SMTP backend has
    nothing to connect to (no mail server ever configured on App Service).
    """

    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        self._client = None

    def open(self):
        if self._client is None:
            self._client = EmailClient.from_connection_string(
                settings.AZURE_COMMUNICATION_CONNECTION_STRING
            )
        return True

    def close(self):
        self._client = None

    def send_messages(self, email_messages):
        if not email_messages:
            return 0
        self.open()
        sent = 0
        for message in email_messages:
            try:
                content = {"subject": message.subject, "plainText": message.body}
                for alt_body, alt_type in getattr(message, "alternatives", []):
                    if alt_type == "text/html":
                        content["html"] = alt_body
                        break
                payload = {
                    "senderAddress": message.from_email,
                    "recipients": {"to": [{"address": addr} for addr in message.to]},
                    "content": content,
                }
                if message.extra_headers:
                    # e.g. List-Unsubscribe on newsletters (newsletter/sending.py).
                    payload["headers"] = dict(message.extra_headers)
                poller = self._client.begin_send(payload)
                # Bulk sends only need Azure to accept the message; waiting for
                # each one's final status would make a newsletter batch crawl.
                if getattr(message, "wait_for_delivery", True):
                    poller.result()
                sent += 1
            except Exception:
                if not self.fail_silently:
                    raise
        return sent
