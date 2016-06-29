from django.core.urlresolvers import reverse
from django.db import models


class Game(models.Model):
    name = models.CharField(max_length=50)
    info = models.TextField()
    rnr_image_id = models.IntegerField(null=True)
    # TODO remove
    step_id = models.IntegerField()
    displayed = models.BooleanField(default=False)

    def get_absolute_url(self):
        return reverse('game_detail', args=[self.pk])

    def __str__(self):
        return self.name
