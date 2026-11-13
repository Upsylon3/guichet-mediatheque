"""Préparer deux comptes fictifs pour une base de développement vide.

Le SQL généré est réservé à l'éditeur SQL privilégié du projet d'essai.
Il ne doit jamais être exécuté depuis le navigateur ou une base de service.
Pour l'exploitation, utiliser le provisionnement Auth approuvé par la DSI.
"""
import json
import secrets
from pathlib import Path

root = Path(__file__).resolve().parents[1]
accounts = root / '.env.accounts.json'
sql_file = root / '.env.provision.sql'
if accounts.exists() or sql_file.exists():
    raise SystemExit('Les comptes sont déjà préparés. Réutiliser les fichiers locaux existants.')
data = {role: {'email': role + '@guichet.example', 'password': secrets.token_urlsafe(24)}
        for role in ('agent', 'administrateur')}
accounts.write_text(json.dumps(data, indent=2), encoding='utf-8')
sql = ['begin;']
for role, account in data.items():
    email, password = account['email'], account['password']
    sql.append(f"""
with nouveau as (
 insert into auth.users (
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  confirmation_token,recovery_token,email_change_token_new,email_change,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
 ) values (
  '00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated',
  '{email}',extensions.crypt('{password}',extensions.gen_salt('bf')),now(),
  '','','','','{{"provider":"email","providers":["email"]}}'::jsonb,'{{}}'::jsonb,now(),now()
 ) returning id,email
), identite as (
 insert into auth.identities (provider_id,user_id,identity_data,provider,created_at,updated_at)
 select id::text,id,jsonb_build_object('sub',id::text,'email',email,'email_verified',true),
 'email',now(),now() from nouveau
)
insert into guichet_prive.habilitations(compte,profil) select id,'{role}' from nouveau;
""")
sql.append('commit;')
sql_file.write_text('\n'.join(sql), encoding='utf-8')
print('Comptes préparés dans .env.accounts.json ; SQL privé dans .env.provision.sql.')
