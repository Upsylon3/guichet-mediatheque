"""Actualiser les ouvertures JV depuis le calendrier officiel de la zone C (élèves).

Les créneaux et dates témoins du classeur restent dans dev/video-schedule.json.
Après actualisation, construire et tester, puis préparer une nouvelle migration SQL
pour reporter la nouvelle grille dans la base ; ne pas rejouer une migration passée.
"""

import datetime as dt
import gzip
import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "dev/video-schedule.json"
SCHOOL_API = "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records"
PUBLIC_API = "https://calendrier.api.gouv.fr/jours-feries/metropole.json"


def fetch_json(url):
    with urlopen(url, timeout=30) as response:
        data = response.read()
    if data[:2] == b"\x1f\x8b":
        data = gzip.decompress(data)
    return json.loads(data)


def paris_date(value):
    return dt.datetime.fromisoformat(value).astimezone(ZoneInfo("Europe/Paris")).date()


def generate(schedule, records, public_holidays):
    periods = []
    incomplete = []
    for record in records:
        if record["zones"] != "Zone C" or record["location"] != "Montpellier":
            continue
        if record["population"] not in ("-", "Élèves"):
            continue  # La rentrée des enseignants ne détermine pas les vacances des joueurs.
        if not (
            "Vacances" in record["description"]
            or record["description"].startswith("Pont")
        ):
            continue
        if record["annee_scolaire"] < "2025-2026":
            continue
        start, end = paris_date(record["start_date"]), paris_date(record["end_date"])
        if end <= start:
            incomplete.append(
                {"name": record["description"], "schoolYear": record["annee_scolaire"]}
            )
            continue  # Aucune fin de vacances n’est inventée pour un enregistrement incomplet.
        periods.append(
            {
                "name": record["description"],
                "schoolYear": record["annee_scolaire"],
                "start": str(start),
                "end": str(end),
            }
        )
    if not periods:
        raise ValueError("Aucune période officielle complète de zone C reçue")
    openings = {}
    for period in periods:
        day, end = dt.date.fromisoformat(period["start"]), dt.date.fromisoformat(
            period["end"]
        )
        while day < end:  # La date de reprise des cours est exclue.
            date = str(day)
            if day.weekday() in (1, 3, 4) and date not in public_holidays:
                openings[date] = (
                    schedule["wednesday"]
                    if day.weekday() == 1
                    else ["15:15–16:45", "16:45–18:15"]
                )
            day += dt.timedelta(days=1)
    missing = [date for date in schedule["workbookExtraDates"] if date not in openings]
    if missing:
        raise ValueError(
            "Dates du classeur hors des vacances zone C : " + ", ".join(missing)
        )
    years = range(
        min(int(p["start"][:4]) for p in periods),
        max(int(p["end"][:4]) for p in periods) + 1,
    )
    return {
        **schedule,
        "schoolHolidays": periods,
        "additionalDates": dict(sorted(openings.items())),
        "publicHolidays": {
            k: v for k, v in sorted(public_holidays.items()) if int(k[:4]) in years
        },
        "calendarSources": {
            "school": SCHOOL_API,
            "publicHolidays": PUBLIC_API,
            "checkedOn": str(dt.datetime.now(ZoneInfo("Europe/Paris")).date()),
            "incompletePeriods": incomplete,
        },
    }


if __name__ == "__main__":
    schedule = json.loads(TARGET.read_text(encoding="utf-8"))
    query = urlencode(
        {
            "where": "location='Montpellier' and start_date >= '2025-01-01'",
            "limit": 100,
            "order_by": "start_date",
        }
    )
    response = fetch_json(SCHOOL_API + "?" + query)
    if response["total_count"] != len(response["results"]):
        raise SystemExit(
            "Réponse officielle paginée : aucune grille partielle n’est enregistrée"
        )
    result = generate(schedule, response["results"], fetch_json(PUBLIC_API))
    TARGET.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"{len(result['schoolHolidays'])} périodes zone C ; {len(result['additionalDates'])} ouvertures supplémentaires ; toutes les dates témoins du classeur concordent."
    )
