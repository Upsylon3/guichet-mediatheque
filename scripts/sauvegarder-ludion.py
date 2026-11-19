"""Exporte les inscriptions ou les restaure dans une base locale isolée."""

import json
import sys
from pathlib import Path

import psycopg
from psycopg.types.json import Jsonb


EXPORT = """
with borne as (
    select (current_timestamp at time zone 'Europe/Paris')::date as jour
), inscriptions as (
    select a.* from guichet_prive.activites a, borne b
    where a.jour >= b.jour - 30 and a.type in ('vid', 'ani', 'guest', 'count')
), activites as (
    select * from inscriptions
    union
    select a.* from guichet_prive.activites a
    join inscriptions i on i.parent = a.id
), cartes as (
    select distinct u.id, u.carte from public.usagers u
    join activites a on a.carte = u.carte
)
select jsonb_build_object(
    'version', 1,
    'date', (select jour from borne),
    'activites', coalesce((select jsonb_agg(a order by a.id) from activites a), '[]'),
    'cartes', coalesce((select jsonb_agg(c order by c.id) from cartes c), '[]')
)
"""


def main():
    document = json.load(sys.stdin)
    restauration = sys.argv[1:] == ["--restaurer-local"]
    try:
        if restauration:
            restaurer_local(document)
            return 0
        configuration = document
        with psycopg.connect(
            host=configuration["host"],
            dbname="postgres",
            port=5432,
            user=configuration["user"],
            password=configuration["password"],
            sslmode="verify-full",
            sslrootcert=configuration["certificate"],
            connect_timeout=15,
            options="-c statement_timeout=60000",
        ) as connection:
            connection.read_only = True
            snapshot = connection.execute(EXPORT).fetchone()[0]
    except psycopg.Error as error:
        operation = "restauration" if restauration else "sauvegarde"
        print(f"Échec de la {operation} PostgreSQL ({error.sqlstate or 'connexion'}).", file=sys.stderr)
        return 1

    print(json.dumps(snapshot, ensure_ascii=True))
    return 0


def restaurer_local(document):
    sql = Path(__file__).resolve().parents[1] / "supabase/maintenance/restaurer_inscriptions_ludion.sql"
    with psycopg.connect(
        host="127.0.0.1", dbname="ludion_restauration", connect_timeout=10,
    ) as connection:
        connection.execute("create temporary table copie_ludion (document jsonb not null) on commit drop")
        connection.execute("insert into copie_ludion (document) values (%s)", (Jsonb(document),))
        connection.execute(sql.read_text(encoding="utf-8"))
    print(f"Restauration locale : {len(document['activites'])} activites.")


if __name__ == "__main__":
    sys.exit(main())
