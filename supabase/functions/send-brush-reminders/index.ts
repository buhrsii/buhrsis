import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

Deno.serve(async (req: Request) => {
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

    const [{ data: token }, { data: vapidPrivate }, { data: vapidPublic }] = await Promise.all([
      sb.rpc("buhrsi_push_secret", { p_name: "buhrsi_push_cron_token" }),
      sb.rpc("buhrsi_push_secret", { p_name: "buhrsi_vapid_private" }),
      sb.rpc("buhrsi_push_secret", { p_name: "buhrsi_vapid_public" })
    ]);

    if (!token || req.headers.get("x-buhrsi-cron-token") !== token) {
      return new Response("unauthorized", { status: 401 });
    }

    webpush.setVapidDetails("https://buhrsis-appv3.vercel.app", vapidPublic, vapidPrivate);
    const { data: due, error } = await sb.rpc("buhrsi_due_push_reminders", { p_now: new Date().toISOString() });
    if (error) throw error;

    const delivered = new Set<string>();
    let sent = 0;
    for (const row of due || []) {
      const payload = JSON.stringify({
        title: "Buhrsi’s erinnert dich 🪥",
        body: row.period === "morning"
          ? `Guten Morgen ${row.child_name}! Zeit zum Zähneputzen.`
          : `Hey ${row.child_name}! Zeit fürs Zähneputzen am Abend.`,
        tag: `buhrsii-${row.child_id}-${row.reminder_date}-${row.period}`,
        url: "/"
      });

      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          payload,
          { TTL: 900 }
        );
        sent++;
        delivered.add(`${row.child_id}|${row.reminder_date}|${row.period}`);
      } catch (e: any) {
        console.error("push failed", row.subscription_id, e?.statusCode || e?.message || e);
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await sb.from("buhrsi_push_subscriptions")
            .update({ active: false, updated_at: new Date().toISOString() })
            .eq("id", row.subscription_id);
        }
      }
    }

    for (const key of delivered) {
      const [child, date, period] = key.split("|");
      await sb.rpc("buhrsi_mark_reminder_delivered", { p_child: child, p_date: date, p_period: period });
    }

    return new Response(JSON.stringify({ ok: true, due: (due || []).length, sent }), {
      headers: { "content-type": "application/json" }
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: e?.message || String(e) }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
});
