"""The Games, read from games.toml, with their descriptions from descriptions/<slug>.txt."""

import tomllib
from dataclasses import dataclass
from functools import cache
from pathlib import Path

from django.urls import reverse

GAMES_FILE = Path(__file__).with_name("games.toml")
DESCRIPTIONS_DIR = Path(__file__).with_name("descriptions")


@dataclass(frozen=True)
class Game:
    slug: str
    name: str
    info: str
    command: str
    displayed: bool = False
    refresh_code: int | None = None

    def get_absolute_url(self):
        return reverse("game_detail", args=[self.slug])


@cache
def all_games():
    """Every Game in games.toml, in file order."""
    with GAMES_FILE.open("rb") as f:
        games = tomllib.load(f)["game"]
    return tuple(Game(info=description(fields["slug"]), **fields) for fields in games)


def description(slug):
    return (DESCRIPTIONS_DIR / f"{slug}.txt").read_text().strip()


def displayed_games():
    return [game for game in all_games() if game.displayed]


def get_game(slug):
    """The Game with this slug, or None."""
    return next((game for game in all_games() if game.slug == slug), None)
