"""Vérifier le contrat Zone C du planning, sans requête réseau en CI."""

import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "video_calendar", ROOT / "scripts/update-video-calendar.py"
)
calendar = importlib.util.module_from_spec(spec)
spec.loader.exec_module(calendar)


class VideoCalendarTest(unittest.TestCase):
    def setUp(self):
        self.schedule = json.loads(
            (ROOT / "dev/video-schedule.json").read_text(encoding="utf-8")
        )

    def test_workbook_dates_are_all_zone_c_holidays(self):
        self.assertEqual(len(self.schedule["workbookExtraDates"]), 29)
        for date in self.schedule["workbookExtraDates"]:
            self.assertIn(date, self.schedule["additionalDates"])
            self.assertTrue(
                any(
                    p["start"] <= date < p["end"]
                    for p in self.schedule["schoolHolidays"]
                )
            )
            self.assertNotIn(date, self.schedule["publicHolidays"])

    def test_zone_c_2027_not_other_zones_or_school_days(self):
        openings = self.schedule["additionalDates"]
        self.assertEqual(
            openings["2027-02-09"], ["13:45–15:15", "15:15–16:45", "16:45–17:45"]
        )
        self.assertEqual(openings["2027-02-19"], ["15:15–16:45", "16:45–18:15"])
        self.assertNotIn(
            "2027-02-23", openings
        )  # La zone C a repris, même si d’autres zones sont en vacances.
        self.assertNotIn(
            "2026-12-18", openings
        )  # Les vacances commencent le lendemain.
        self.assertNotIn("2027-01-05", openings)  # Les cours ont repris le 4 janvier.
        self.assertNotIn(
            "2027-01-01", openings
        )  # Jour férié, même pendant les vacances.
        self.assertIn("2026-11-11", self.schedule["publicHolidays"])

    def test_paris_boundary_and_pupils_not_teachers(self):
        self.assertEqual(
            str(calendar.paris_date("2026-07-03T22:00:00+00:00")), "2026-07-04"
        )
        base = copy.deepcopy(self.schedule)
        base["workbookExtraDates"] = []
        rows = [
            dict(
                zones="Zone C",
                location="Montpellier",
                population="Élèves",
                description="Vacances d'Été",
                annee_scolaire="2025-2026",
                start_date="2026-07-03T22:00:00+00:00",
                end_date="2026-08-31T22:00:00+00:00",
            )
        ]
        rows.append(
            {
                **rows[0],
                "population": "Enseignants",
                "end_date": "2026-08-30T22:00:00+00:00",
            }
        )
        generated = calendar.generate(base, rows, {})
        self.assertEqual(generated["schoolHolidays"][0]["end"], "2026-09-01")
        self.assertNotIn("2026-09-01", generated["additionalDates"])
        self.assertEqual(len(generated["schoolHolidays"]), 1)
        base["workbookExtraDates"] = ["2026-11-17"]
        with self.assertRaisesRegex(ValueError, "hors des vacances"):
            calendar.generate(base, rows, {})


if __name__ == "__main__":
    unittest.main()
