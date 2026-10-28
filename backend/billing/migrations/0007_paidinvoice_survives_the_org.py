"""A paid invoice now outlives the organisation that paid it.

Deleting an organisation (orgs/services.py::delete_organization) used to take
its PaidInvoice rows with it. Those rows are the list of faturas to issue and
the record that they were: an invoicing record has to be kept whether or not
the company still has an account here. The row already carries the customer's
name and tax id, so it stands on its own with `org` null.
"""

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0006_delete_processedwebhookevent'),
        ('orgs', '0030_membership_details_confirmed_by'),
    ]

    operations = [
        migrations.AlterField(
            model_name='paidinvoice',
            name='org',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='paid_invoices', to='orgs.organization'),
        ),
    ]
