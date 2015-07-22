from django.core.urlresolvers import reverse
from django.db import models


class Game(models.Model):
    name = models.CharField(max_length=50)
    info = models.TextField()
    step_id = models.IntegerField()

    def get_absolute_url(self):
        return reverse('game_detail', args=[self.pk])

    def __str__(self):
        return self.name
