"""
Django settings for beedero project.
"""

import os
from pathlib import Path
from urllib.parse import urlparse

import dj_database_url
import sentry_sdk
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv
from sentry_sdk.integrations.django import DjangoIntegration

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    raise ImproperlyConfigured(
        "DJANGO_SECRET_KEY must be set — there is no insecure fallback."
    )

# Safe default: production. Dev opts in explicitly with DJANGO_DEBUG=true.
DEBUG = os.environ.get("DJANGO_DEBUG", "false").lower() == "true"

# Separate Sentry project from the frontend's — own DSN, own env var. No-op
# (SDK never initializes) until SENTRY_DSN is set, so it's safe to leave
# unset in local dev.
SENTRY_DSN = os.environ.get("SENTRY_DSN")
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration()],
        traces_sample_rate=1.0 if DEBUG else 0.1,
        send_default_pii=False,
        environment="development" if DEBUG else "production",
    )

ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "").rstrip("/")
if not FRONTEND_URL:
    if DEBUG:
        FRONTEND_URL = "http://localhost:3000"
    else:
        raise ImproperlyConfigured(
            "FRONTEND_URL must be set in production so email links point to "
            "the public frontend, not localhost."
        )

frontend_url_parts = urlparse(FRONTEND_URL)
if frontend_url_parts.scheme not in {"http", "https"} or not frontend_url_parts.netloc:
    raise ImproperlyConfigured("FRONTEND_URL must be an absolute URL.")

if not DEBUG and frontend_url_parts.hostname in {"localhost", "127.0.0.1", "::1"}:
    raise ImproperlyConfigured(
        "FRONTEND_URL cannot point to localhost when DJANGO_DEBUG=false."
    )

# Public origin of this API itself — used to build absolute links (digest
# unsubscribe, open-tracking pixel) that email clients fetch directly,
# bypassing the Next.js server entirely.
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000").rstrip("/")


INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "storages",
    "accounts",
    "orgs",
    "billing",
    "analytics",
    "credibility",
    "social",
    "notifications",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # Camada 1 (defesa em profundidade): injeta o viewer para RLS. No-op fora do Postgres.
    "orgs.middleware.RLSViewerMiddleware",
    # §7: respostas autenticadas nunca em cache partilhada.
    "orgs.middleware.PrivateCacheMiddleware",
]

ROOT_URLCONF = "beedero.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "beedero.wsgi.application"


# Database — always Postgres via DATABASE_URL, in every environment (also
# apply backend/docs/rls_postgres.sql). No SQLite fallback.
if not os.environ.get("DATABASE_URL"):
    raise ImproperlyConfigured(
        "DATABASE_URL must be set — the app always uses Postgres, there is no "
        "SQLite fallback."
    )

DATABASES = {"default": dj_database_url.parse(os.environ["DATABASE_URL"])}

# Shared across gunicorn workers — DatabaseCache uses the Postgres we already run.
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.db.DatabaseCache",
        "LOCATION": "django_cache",
    }
}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Media (user uploads, e.g. profile pictures) — always Azure Blob Storage,
# in every environment. No local-disk fallback.
AZURE_ACCOUNT_NAME = os.environ.get("AZURE_ACCOUNT_NAME")
AZURE_ACCOUNT_KEY = os.environ.get("AZURE_ACCOUNT_KEY")
AZURE_CONTAINER = os.environ.get("AZURE_CONTAINER", "media")

if not (AZURE_ACCOUNT_NAME and AZURE_ACCOUNT_KEY):
    raise ImproperlyConfigured(
        "AZURE_ACCOUNT_NAME and AZURE_ACCOUNT_KEY must be set — media storage "
        "always uses Azure Blob Storage, there is no local-disk fallback."
    )

MEDIA_URL = f"https://{AZURE_ACCOUNT_NAME}.blob.core.windows.net/{AZURE_CONTAINER}/"

# Credibility-ladder documents (annual accounts, tax/SS clearance, ...) —
# a second, non-public container on the same storage account. Never served
# by MEDIA_URL/direct URL; only ever read through a short-lived SAS token
# minted by credibility.storage.private_doc_url. The container itself must
# be created in Azure with public access disabled before nivel 3 goes live.
AZURE_DOCS_PRIVATE_CONTAINER = os.environ.get("AZURE_DOCS_PRIVATE_CONTAINER", "docs-private")

STORAGES = {
    "default": {"BACKEND": "storages.backends.azure_storage.AzureStorage"},
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

# Transactional email (verification, password reset) — always Azure
# Communication Services, in every environment. No unconfigured SMTP
# fallback (that's what silently swallowed every verification email before).
AZURE_COMMUNICATION_CONNECTION_STRING = os.environ.get("AZURE_COMMUNICATION_CONNECTION_STRING")
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "")

if not (AZURE_COMMUNICATION_CONNECTION_STRING and DEFAULT_FROM_EMAIL):
    raise ImproperlyConfigured(
        "AZURE_COMMUNICATION_CONNECTION_STRING and DEFAULT_FROM_EMAIL must be "
        "set — transactional email always uses Azure Communication Services, "
        "there is no SMTP fallback."
    )

EMAIL_BACKEND = "beedero.email_backend.AzureCommunicationEmailBackend"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# App Service termina TLS na edge e reencaminha em HTTP; sem isto o Django
# nunca reconhece o pedido como seguro (afeta cookies seguros, CSRF).
SECURE_SSL_REDIRECT = not DEBUG
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_HSTS_SECONDS = 0 if DEBUG else 60 * 60 * 24 * 30
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG

CSRF_TRUSTED_ORIGINS = [
    o for o in os.environ.get("CSRF_TRUSTED_ORIGINS", "").split(",") if o
]

REST_FRAMEWORK = {
    # Microsoft Entra External ID (CIAM) is the only authentication path —
    # native email/password auth was removed in favor of it.
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "accounts.entra_auth.EntraJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
}

# --- Microsoft Entra External ID (CIAM) ------------------------------------
# Deliberately NOT validated with ImproperlyConfigured like the settings
# above: the Entra tenant may not exist yet in a given environment (it
# doesn't, as of this writing, in any of ours). EntraJWTAuthentication and
# get_or_provision_user must degrade to "Entra login unavailable" rather than
# crash the whole app when these are unset.
ENTRA_TENANT_ID = os.environ.get("ENTRA_TENANT_ID", "")
ENTRA_TENANT_SUBDOMAIN = os.environ.get("ENTRA_TENANT_SUBDOMAIN", "")
ENTRA_CUSTOM_DOMAIN = os.environ.get("ENTRA_CUSTOM_DOMAIN", "")  # e.g. auth.beedero.com
ENTRA_API_CLIENT_ID = os.environ.get("ENTRA_API_CLIENT_ID", "")  # audience of the beedero-api app registration

_entra_authority = (
    f"https://{ENTRA_CUSTOM_DOMAIN}"
    if ENTRA_CUSTOM_DOMAIN
    else f"https://{ENTRA_TENANT_SUBDOMAIN}.ciamlogin.com"
    if ENTRA_TENANT_SUBDOMAIN
    else ""
)
ENTRA_ISSUER = f"{_entra_authority}/{ENTRA_TENANT_ID}/v2.0" if _entra_authority and ENTRA_TENANT_ID else ""
# JWKS always resolves against the tenant subdomain (not the custom domain),
# per Entra External ID's discovery document layout.
ENTRA_JWKS_URL = (
    f"https://{ENTRA_TENANT_SUBDOMAIN}.ciamlogin.com/{ENTRA_TENANT_ID}/discovery/v2.0/keys"
    if ENTRA_TENANT_SUBDOMAIN and ENTRA_TENANT_ID
    else ""
)

CORS_ALLOWED_ORIGINS = os.environ.get(
    "CORS_ALLOWED_ORIGINS", "http://localhost:3000"
).split(",")
CORS_ALLOW_CREDENTIALS = True
