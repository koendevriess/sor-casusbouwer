// Stuurt de feedback van een medewerker of leermeester per e-mail naar de kandidaat.
// Instellen (Supabase → Edge Functions → Secrets): SMTP_HOST, SMTP_USER, SMTP_PASS,
// optioneel SMTP_PORT (standaard 465; poort 587 en 25 zijn op Supabase geblokkeerd) en SMTP_FROM.
import { createClient } from "jsr:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    const h = req.headers.get("Access-Control-Request-Headers");
    return new Response("ok", { headers: h ? { ...cors, "Access-Control-Allow-Headers": h } : cors });
  }
  if (req.method !== "POST") return json({ error: "methode niet toegestaan" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u, error: ue } = await admin.auth.getUser(jwt);
  if (ue || !u?.user) return json({ error: "niet ingelogd" }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "ongeldig verzoek" }, 400); }
  const kid = String(body?.kandidaat_id || "");
  const tekst = String(body?.tekst || "").slice(0, 20000);
  const onderwerp = String(body?.onderwerp || "Feedback op je casus praktijktoets 3").replace(/[\r\n]+/g, " ").slice(0, 150);
  if (!/^[0-9a-f-]{36}$/i.test(kid) || !tekst.trim()) return json({ error: "ongeldig verzoek" }, 400);

  // alleen medewerkers, of een leermeester die aan deze kandidaat is gekoppeld
  const { data: me } = await admin.from("leden").select("id,naam,email,rol").eq("user_id", u.user.id).maybeSingle();
  if (!me || !["medewerker", "leermeester"].includes(me.rol)) return json({ error: "geen toegang" }, 403);
  if (me.rol === "leermeester") {
    const { data: t } = await admin.from("leermeester_toegang").select("kandidaat_id")
      .eq("leermeester_id", me.id).eq("kandidaat_id", kid).maybeSingle();
    let mag = !!t;
    if (!mag) {
      const { data: kk } = await admin.from("leden").select("stad").eq("id", kid).maybeSingle();
      const { data: g } = await admin.from("leermeester_gebied").select("stad")
        .eq("leermeester_id", me.id).eq("stad", kk?.stad || "amsterdam").maybeSingle();
      mag = !!g;
    }
    if (!mag) return json({ error: "geen toegang" }, 403);
  }
  const { data: k } = await admin.from("leden").select("id,naam,email,rol").eq("id", kid).maybeSingle();
  if (!k || k.rol !== "kandidaat" || !k.email) return json({ error: "geen e-mailadres bekend" }, 400);

  const host = Deno.env.get("SMTP_HOST"), user = Deno.env.get("SMTP_USER"), pass = Deno.env.get("SMTP_PASS");
  if (!host || !user || !pass) return json({ error: "niet_ingesteld" }, 503);
  const port = Number(Deno.env.get("SMTP_PORT") || 465);
  const from = Deno.env.get("SMTP_FROM") || user;

  try {
    const tr = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
    await tr.sendMail({
      from: { name: `${me.naam || "Flagship Academy"} (Flagship Academy)`, address: from },
      to: k.email,
      replyTo: me.email || undefined,
      subject: onderwerp,
      text: tekst,
    });
  } catch (e) {
    console.error("versturen mislukt", e);
    return json({ error: "versturen mislukt" }, 502);
  }
  const op = new Date().toISOString();
  await admin.from("feedback").update({ gemaild_op: op }).eq("kandidaat_id", kid);
  return json({ ok: true, op });
});
