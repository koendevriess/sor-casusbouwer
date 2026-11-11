// Maakt AI-conceptfeedback op een casus. Het concept is alleen zichtbaar voor medewerkers en
// leermeesters (tabel ai_concept, migratie 017); de kandidaat ziet het nooit.
//
// Aanroepen:
//  - door de kandidaat zelf, direct na het inleveren (alleen voor de eigen, ingeleverde casus);
//  - door een medewerker of gekoppelde leermeester ("Concept vernieuwen").
// De analyse loopt op de achtergrond; de functie antwoordt meteen met 202.
//
// Instellen (Supabase -> Edge Functions -> Secrets):
//   ANTHROPIC_API_KEY  verplicht (API-sleutel van Flagship bij Anthropic)
//   AI_MODEL           optioneel, standaard claude-sonnet-5
//
// Kosten: er gaat alleen iets naar de AI als ALLE drie kloppen:
//   1. medewerkers hebben AI aangezet bij Instellingen (tabel instellingen, sleutel 'ai', database-update 022);
//   2. ANTHROPIC_API_KEY is ingesteld;
//   3. de maandlimiet is nog niet bereikt (functie ai_gebruik_tellen, tabel ai_gebruik).
// Een aanroep met { status: true } (alleen medewerkers) geeft terug of de sleutel is ingesteld; dat kost niets.
//
// Privacy: naam, geboortedatum, CBR-relatienummer, foto's en kaartcoördinaten gaan niet mee naar de AI.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { VOORBEELDCASUS, VOORBEELD_CONTROLES } from "./voorbeeldcasus.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

// stappen van de casus met de eisen waarop de AI beoordeelt
const STAPPEN: Record<string, { t: string; eis: string }> = {
  kandidaat: { t: "Kandidaat & schip", eis: "Gegevens volledig ingevuld; maten van het schip (lengte, breedte, hoogte boven water, diepgang, aantal passagiers) kloppen met het certificaat van onderzoek (CVO)." },
  route: { t: "Route", eis: "Route van 30 tot 45 minuten, nergens tegen het eenrichtingsverkeer in, het schip past overal. Logische, veilige route met de opstaplocatie als begin en eind." },
  bruggen: { t: "Bruggen", eis: "Alle doorvaarthoogtes ingevuld, geen te lage bruggen, krappe bruggen benoemd met wat de schipper daar doet." },
  aandacht: { t: "Aandachtspunten", eis: "Alle categorieën aandachtspunten zijn beschreven, concreet per plek op de route: wat is het risico en wat doet de schipper." },
  borden: { t: "Verkeerstekens", eis: "Verkeerstekens op de route met de juiste betekenis, de plek en wat de schipper ermee doet." },
  manoeuvres: { t: "Manoeuvres", eis: "De vier bijzondere manoeuvres zijn op de route geplaatst en stap voor stap beschreven (roer, motor, uitkijk, communicatie)." },
  marifoon: { t: "Marifoon", eis: "Elk meldpunt heeft een correcte melding (eigen bootnaam, de gracht waar je vaart, 'kruist', de gracht die je oversteekt) en de bijbehorende manoeuvre." },
  teksten: { t: "Teksten voor gasten", eis: "Welkomstwoord in het Nederlands en Engels (met veiligheidsinstructie), 2 à 3 bezienswaardigheden en een slotwoord; duidelijk en gastvrij." },
  veiligheid: { t: "Veiligheid", eis: "Reddingsvesten (aantal en plaats), reddingsboeien, het juiste pictogram voor de verbanddoos, type brandblusser en de juiste werking." },
  milieu: { t: "Milieu", eis: "Vraag 12 tot en met 15 inhoudelijk juist beantwoord: energiebesparende maatregelen, geldt dit bij elektrisch varen, betekenis van 0% uitstoot, milieuvriendelijke aandrijvingen." },
};
const IDS = Object.keys(STAPPEN);

// casus zonder persoonsgegevens, foto's en kaartcoördinaten
const WEG = new Set(["ui", "pos", "pts", "wps", "latlng", "lat", "lng", "x", "y", "foto", "fotos", "src", "geboortedatum", "cbr"]);
function opschonen(v: unknown, diepte = 0): unknown {
  if (diepte > 8) return undefined;
  if (typeof v === "string") return v.startsWith("data:") ? undefined : v.slice(0, 3000);
  if (Array.isArray(v)) {
    if (v.length && v.every((x) => typeof x === "number")) return undefined;
    return v.slice(0, 60).map((x) => opschonen(x, diepte + 1)).filter((x) => x !== undefined);
  }
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (WEG.has(k)) continue;
      const y = opschonen(x, diepte + 1);
      if (y !== undefined && y !== "" && !(Array.isArray(y) && !y.length)) o[k] = y;
    }
    return o;
  }
  return v;
}
function casusTekst(casus: unknown, max = 60000): string {
  const c = { ...(casus as Record<string, unknown> || {}) };
  delete c.kandidaat; // naam, geboortedatum en CBR-nummer nooit naar de AI
  delete c.opstap;
  return JSON.stringify(opschonen(c)).slice(0, max);
}
function controlesTekst(x: unknown): string {
  if (!x || typeof x !== "object") return "(geen automatische controles beschikbaar)";
  const o = x as { controles?: { stap?: string; ok?: boolean; niveau?: string; label?: string }[]; route?: unknown };
  const r = (o.controles || []).slice(0, 200).map((c) =>
    `- [${String(c.stap || "").slice(0, 20)}] ${c.ok ? "OK" : c.niveau === "warn" ? "LET OP" : "NIET OK"}: ${String(c.label || "").slice(0, 200)}`);
  if (o.route) r.push("Route-analyse: " + JSON.stringify(o.route).slice(0, 4000));
  return r.join("\n") || "(geen automatische controles beschikbaar)";
}
function veiligeControles(b: Record<string, unknown>) {
  const cs = Array.isArray(b.controles) ? b.controles : [];
  const controles = cs.slice(0, 200).map((c: Record<string, unknown>) => ({
    stap: String(c?.stap || "").slice(0, 20), ok: !!c?.ok, niveau: String(c?.niveau || "").slice(0, 10), label: String(c?.label || "").slice(0, 200),
  }));
  let route: unknown = null;
  try { if (b.route && typeof b.route === "object") route = JSON.parse(JSON.stringify(b.route).slice(0, 8000)); } catch { route = null; }
  return { controles, route };
}

const TOOL = {
  name: "conceptfeedback",
  description: "Lever de conceptfeedback per stap aan.",
  input_schema: {
    type: "object",
    properties: {
      algemeen: { type: "string", description: "Korte algemene samenvatting voor de kandidaat (max. 5 zinnen)." },
      stappen: {
        type: "array",
        items: {
          type: "object",
          properties: {
            stap: { type: "string", enum: IDS },
            status: { type: "string", enum: ["ok", "aanpassen"] },
            tekst: { type: "string", description: "Feedback aan de kandidaat, je-vorm, concreet. Bij ok mag dit kort zijn." },
            zekerheid: { type: "string", enum: ["hoog", "middel", "laag"] },
          },
          required: ["stap", "status", "tekst", "zekerheid"],
        },
      },
    },
    required: ["algemeen", "stappen"],
  },
};

const SYSTEEM = `Je bent beoordelaar bij Flagship Academy (Amsterdam) voor praktijktoets 3 van het CBR-examen Schipper Open Rondvaartboot (SOR).
Een kandidaat heeft een casus gemaakt: een vaarroute met bruggen, aandachtspunten, verkeerstekens, manoeuvres, marifoonmeldingen, teksten voor gasten, veiligheid en milieu.
Je schrijft CONCEPTFEEDBACK die een medewerker eerst controleert en goedkeurt voordat de kandidaat hem ziet.

Werkwijze:
- Beoordeel elke stap tegen de eisen en vergelijk met de voorbeeldcasussen (goedgekeurde casussen van eerdere kandidaten). Neem niets letterlijk over uit de voorbeelden.
- Gebruik de automatische controles van de casusbouwer als feiten (route-duur, eenrichtingsverkeer, bruggen).
- Status "ok" als de stap voldoende is voor het examen; anders "aanpassen".
- Schrijf in het Nederlands, je-vorm, kort en concreet: wat moet beter en hoe. Geen algemene complimenten of opvulling. Maximaal 4 zinnen per stap.
- Noem nooit dat je een AI bent. Verzin geen feiten over Amsterdam die je niet zeker weet; twijfel je, zet zekerheid op "laag".
- Geef voor elke stap precies één beoordeling.`;

// deno-lint-ignore no-explicit-any
async function analyseer(admin: any, kid: string, extra: unknown, reden: string) {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  const model = Deno.env.get("AI_MODEL") || "claude-sonnet-5";
  const fout = (m: string) => admin.from("ai_concept").update({ status: "fout", fout: m.slice(0, 1500) }).eq("kandidaat_id", kid);
  try {
    const { data: k } = await admin.from("leden").select("id,stad").eq("id", kid).maybeSingle();
    const { data: c } = await admin.from("casussen").select("casus,bijgewerkt").eq("kandidaat_id", kid).maybeSingle();
    if (!k || !c) { await fout("Geen casus gevonden."); return; }
    const stad = k.stad || "amsterdam";

    // voorbeelden: door medewerkers aangewezen goede casussen, anders recent geslaagde casussen (eigen gebied eerst)
    const { data: aangewezen } = await admin.from("ai_voorbeeld").select("kandidaat_id, leden(stad)").neq("kandidaat_id", kid).limit(20);
    let ids = (aangewezen || []).map((r: Record<string, unknown>) => ({ id: r.kandidaat_id as string, stad: ((r.leden as Record<string, string>) || {}).stad || "amsterdam" }));
    if (!ids.length) {
      const { data: g } = await admin.from("leden").select("id,stad").eq("rol", "kandidaat").eq("status", "geslaagd").neq("id", kid)
        .order("geslaagd_op", { ascending: false }).limit(20);
      ids = (g || []).map((r: Record<string, string>) => ({ id: r.id, stad: r.stad || "amsterdam" }));
    }
    ids.sort((a: { stad: string }, b: { stad: string }) => Number(b.stad === stad) - Number(a.stad === stad));
    const voorbeelden: string[] = [
      `### Voorbeeldcasus 1 (de modelcasus van Flagship Academy, gebied amsterdam)\n${casusTekst(VOORBEELDCASUS, 25000)}\n\nAutomatische controles:\n${controlesTekst(VOORBEELD_CONTROLES)}`,
    ];
    for (const v of ids.slice(0, 4)) {
      const [{ data: vc }, { data: vf }, { data: va }] = await Promise.all([
        admin.from("casussen").select("casus").eq("kandidaat_id", v.id).maybeSingle(),
        admin.from("feedback").select("stappen").eq("kandidaat_id", v.id).maybeSingle(),
        admin.from("ai_concept").select("controles").eq("kandidaat_id", v.id).maybeSingle(),
      ]);
      if (!vc) continue;
      const fb = Object.entries((vf?.stappen || {}) as Record<string, { status?: string; tekst?: string }>)
        .filter(([, f]) => f && (f.tekst || f.status)).map(([s, f]) => `- ${s}: ${f.status || ""} ${String(f.tekst || "").slice(0, 600)}`).join("\n");
      voorbeelden.push(`### Voorbeeldcasus ${voorbeelden.length + 1} (goedgekeurde casus van een eerdere kandidaat, gebied ${v.stad})\n${casusTekst(vc.casus, 25000)}\n\nAutomatische controles:\n${controlesTekst(va?.controles)}\n\nFeedback die de opleider op deze casus gaf:\n${fb || "(geen)"}`);
    }

    const eisen = IDS.map((s) => `- ${s} (${STAPPEN[s].t}): ${STAPPEN[s].eis}`).join("\n");
    const tekst = `## Eisen per stap\n${eisen}\n\n## Voorbeelden van goede casussen\n${voorbeelden.join("\n\n") || "(nog geen voorbeeldcasussen beschikbaar; beoordeel op de eisen)"}\n\n## Casus van de kandidaat (gebied ${stad})\n${casusTekst(c.casus)}\n\n## Automatische controles van de casusbouwer\n${controlesTekst(extra)}\n\nGeef nu de conceptfeedback met de tool conceptfeedback.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model, max_tokens: 4000, system: SYSTEEM, tools: [TOOL], tool_choice: { type: "tool", name: TOOL.name },
        messages: [{ role: "user", content: tekst }],
      }),
    });
    if (!res.ok) { await fout(`AI-dienst gaf fout ${res.status}: ${(await res.text()).slice(0, 300)}`); return; }
    const out = await res.json();
    const blok = (out.content || []).find((b: Record<string, unknown>) => b.type === "tool_use");
    const inp = (blok?.input || {}) as { algemeen?: string; stappen?: { stap?: string; status?: string; tekst?: string; zekerheid?: string }[] };
    const stappen: Record<string, unknown> = {};
    for (const s of inp.stappen || []) {
      if (!s || !IDS.includes(String(s.stap))) continue;
      stappen[String(s.stap)] = {
        status: s.status === "ok" ? "ok" : "aanpassen",
        tekst: String(s.tekst || "").slice(0, 3000),
        zekerheid: ["hoog", "middel", "laag"].includes(String(s.zekerheid)) ? s.zekerheid : "middel",
      };
    }
    if (!Object.keys(stappen).length) { await fout("De AI gaf geen bruikbare feedback terug."); return; }
    await admin.from("ai_concept").update({
      status: "klaar", stappen, algemeen: String(inp.algemeen || "").slice(0, 5000), voorbeelden: voorbeelden.length,
      model, fout: null, reden, casus_bijgewerkt: c.bijgewerkt, afgehandeld: {}, gemaakt: new Date().toISOString(),
    }).eq("kandidaat_id", kid);
  } catch (e) {
    console.error("ai-feedback mislukt", e);
    await fout("Analyse mislukt: " + String((e as Error)?.message || e).slice(0, 300));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    const h = req.headers.get("Access-Control-Request-Headers");
    return new Response("ok", { headers: h ? { ...cors, "Access-Control-Allow-Headers": h } : cors });
  }
  if (req.method !== "POST") return json({ error: "methode niet toegestaan" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u, error: ue } = await admin.auth.getUser(jwt);
  if (ue || !u?.user) return json({ error: "niet ingelogd" }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "ongeldig verzoek" }, 400); }

  const { data: me } = await admin.from("leden").select("id,rol").eq("user_id", u.user.id).maybeSingle();
  if (!me) return json({ error: "geen toegang" }, 403);

  // schakelaar en maandlimiet uit Instellingen; ontbreekt de tabel (database-update 022 niet uitgevoerd), dan staat AI uit
  const { data: instRij } = await admin.from("instellingen").select("waarde").eq("sleutel", "ai").maybeSingle();
  const inst = (instRij?.waarde || {}) as { aan?: boolean; maandlimiet?: number };
  const aan = inst.aan === true;
  const sleutel = !!Deno.env.get("ANTHROPIC_API_KEY");

  // statusvraag voor de pagina Instellingen: kost niets, alleen voor medewerkers
  if (body?.status === true) {
    if (me.rol !== "medewerker") return json({ error: "geen toegang" }, 403);
    return json({ sleutel, aan, maandlimiet: inst.maandlimiet ?? 100, model: Deno.env.get("AI_MODEL") || "claude-sonnet-5" });
  }

  const kid = String(body?.kandidaat_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(kid)) return json({ error: "ongeldig verzoek" }, 400);
  const { data: k } = await admin.from("leden").select("id,rol,status,stad,groep_id").eq("id", kid).maybeSingle();
  if (!k || k.rol !== "kandidaat") return json({ error: "geen kandidaat" }, 400);
  const { data: bestaand } = await admin.from("ai_concept").select("status,gestart").eq("kandidaat_id", kid).maybeSingle();
  const recent = bestaand && Date.now() - new Date(bestaand.gestart).getTime() < 10 * 60 * 1000;

  if (me.rol === "kandidaat") {
    // alleen de eigen casus, alleen na inleveren, hooguit eens per 10 minuten
    if (me.id !== kid || k.status !== "ingeleverd") return json({ error: "geen toegang" }, 403);
    if (recent) return json({ ok: true, status: bestaand.status }, 200);
  } else if (me.rol === "leermeester") {
    const { data: t } = await admin.from("leermeester_toegang").select("kandidaat_id").eq("leermeester_id", me.id).eq("kandidaat_id", kid).maybeSingle();
    let mag = !!t;
    if (!mag) {
      const { data: g } = await admin.from("leermeester_gebied").select("stad").eq("leermeester_id", me.id).eq("stad", k.stad || "amsterdam").maybeSingle();
      mag = !!g;
    }
    if (!mag && k.groep_id) {
      // gekoppeld via een examengroep (database-update 021)
      const { data: gr } = await admin.from("leermeester_groep").select("groep_id").eq("leermeester_id", me.id).eq("groep_id", k.groep_id).maybeSingle();
      mag = !!gr;
    }
    if (!mag) return json({ error: "geen toegang" }, 403);
  } else if (me.rol !== "medewerker") return json({ error: "geen toegang" }, 403);
  if (bestaand?.status === "bezig" && recent) return json({ ok: true, status: "bezig" }, 202);

  const reden = me.rol === "kandidaat" ? "inleveren" : String(body?.reden || "handmatig").slice(0, 20);
  const extra = veiligeControles(body);
  const basis = { kandidaat_id: kid, status: "bezig", fout: null, reden, controles: extra, gestart: new Date().toISOString() };
  if (!aan) {
    await admin.from("ai_concept").upsert({ ...basis, status: "uit", fout: "uitgeschakeld" });
    return json({ error: "uitgeschakeld" }, 503);
  }
  if (!sleutel) {
    await admin.from("ai_concept").upsert({ ...basis, status: "uit", fout: "niet_ingesteld" });
    return json({ error: "niet_ingesteld" }, 503);
  }
  // telt deze analyse mee voor de maand; false = limiet bereikt (of AI intussen uitgezet)
  const { data: magTellen, error: telFout } = await admin.rpc("ai_gebruik_tellen");
  if (telFout || magTellen !== true) {
    await admin.from("ai_concept").upsert({ ...basis, status: "uit", fout: "limiet" });
    return json({ error: "limiet" }, 429);
  }
  await admin.from("ai_concept").upsert(basis);
  const werk = analyseer(admin, kid, extra, reden);
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) { EdgeRuntime.waitUntil(werk); return json({ ok: true, status: "bezig" }, 202); }
  await werk;
  return json({ ok: true, status: "klaar" });
});
