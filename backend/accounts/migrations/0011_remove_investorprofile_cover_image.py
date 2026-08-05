from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0010_investorprofile_cover_image"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="investorprofile",
            name="cover_image",
        ),
    ]
