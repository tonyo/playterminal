from django.db import models


class Game(models.Model):
    name = models.CharField(max_length=50)
    info = models.TextField()
    step_id = models.IntegerField()
