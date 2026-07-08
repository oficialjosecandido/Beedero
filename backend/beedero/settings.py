"""
Django settings for beedero project.
"""

import os
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlparse

import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    raise ImproperlyConfigured(
        "DJANGO_SECRET_KEY must be set — there is no insecure fallback."
    )

# Safe default: production. Dev opts in explicitly with DJANGO_DEBUG=true.
DEBUG = os.environ.get("DJANGO_DEBUG", "false").lower() == "true"

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
    "rest_framework_simplejwt.token_blacklist",
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
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

CORS_ALLOWED_ORIGINS = os.environ.get(
    "CORS_ALLOWED_ORIGINS", "http://localhost:3000"
).split(",")
CORS_ALLOW_CREDENTIALS = True
