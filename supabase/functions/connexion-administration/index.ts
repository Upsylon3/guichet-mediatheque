const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};

const json = (body: object, status = 200) =>
  Response.json(body, { status, headers });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (request.method !== "POST") return json({ message: "Action indisponible." }, 405);

  // Utiliser le compte technique déjà habilité dans le guichet.
  const email = Deno.env.get("GUICHET_ADMIN_EMAIL") || "administrateur@guichet.example";
  const url = Deno.env.get("SUPABASE_URL");
  const apikey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !apikey) {
    return json({ message: "Accès administrateur indisponible." }, 503);
  }

  let password;
  try {
    ({ password } = await request.json());
  } catch {
    return json({ message: "Vérifier le mot de passe." }, 400);
  }
  if (typeof password !== "string" || !password || password.length > 256) {
    return json({ message: "Vérifier le mot de passe." }, 400);
  }

  try {
    const auth = await fetch(url + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { apikey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(5000),
    });
    if (auth.status === 429) {
      return json({ message: "Trop de tentatives. Réessayez plus tard." }, 429);
    }
    if (!auth.ok) return json({ message: "Mot de passe incorrect." }, 401);
    const { access_token } = await auth.json();
    const permission = await fetch(url + "/rest/v1/rpc/mon_profil", {
      method: "POST",
      headers: { apikey, Authorization: "Bearer " + access_token, "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(5000),
    });
    if (!permission.ok || await permission.json() !== "administrateur") {
      return json({ message: "Accès administrateur indisponible." }, 403);
    }
    return json({ access_token });
  } catch {
    return json({ message: "Accès administrateur temporairement indisponible." }, 503);
  }
});
