"""The Games: one TOML file per Game in library/ (see library/README.md)."""

import tomllib
from dataclasses import dataclass
from functools import cache
from pathlib import Path

from django.urls import reverse
from django.utils.safestring import mark_safe
from markdown_it import MarkdownIt

LIBRARY_DIR = Path(__file__).with_name("library")

# "js-default" is CommonMark with raw HTML off, so HTML in a description is escaped, and
# validateLink drops javascript:, vbscript:, file: and data: links. Tables and
# strikethrough stay on.
markdown = MarkdownIt("js-default")


@dataclass(frozen=True)
class Game:
    slug: str
    name: str
    command: str
    description: str = ""
    displayed: bool = False
    refresh_code: int | None = None

    def get_absolute_url(self):
        return reverse("game_detail", args=[self.slug])

    @property
    def description_html(self):
        return mark_safe(markdown.render(self.description))


def load_game(path):
    with path.open("rb") as f:
        return Game(slug=path.stem, **tomllib.load(f))


@cache
def all_games():
    """Every Game in library/, by name."""
    games = (load_game(path) for path in LIBRARY_DIR.glob("*.toml"))
    return tuple(sorted(games, key=lambda game: game.name.lower()))


def displayed_games():
    return [game for game in all_games() if game.displayed]


def get_game(slug):
    """The Game with this slug, or None."""
    return next((game for game in all_games() if game.slug == slug), None)
