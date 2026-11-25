import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

let clientPromise;

export function getSupabase() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const response = await fetch("/api/config");
      const config = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(config.error || "Konfigurasi Supabase belum tersedia.");
      }

      if (!config.supabaseUrl || !config.supabaseAnonKey) {
        throw new Error("Konfigurasi Supabase belum lengkap.");
      }

      return {
        appConfig: config,
        supabase: createClient(config.supabaseUrl, config.supabaseAnonKey),
      };
    })();
  }

  return clientPromise;
}
