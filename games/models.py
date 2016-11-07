from django.core.urlresolvers import reverse
from django.db import models


class Game(models.Model):
    name = models.CharField(max_length=50)
    info = models.TextField()
    rnr_image_id = models.IntegerField(null=True)
    displayed = models.BooleanField(default=False)
    refresh_code = models.IntegerField(
        null=True, blank=True,
        help_text="An integer, which represents a key code that will be "
                  "sent to refresh the newly created terminal"
    )

    def get_absolute_url(self):
        return reverse('game_detail', args=[self.pk])

    def __str__(self):
        return self.name
