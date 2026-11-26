module.exports = (_request, response) => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, WHATSAPP_NUMBER } = process.env;
  const whatsappDigits = String(WHATSAPP_NUMBER || "081386544921").replace(/\D/g, "");
  const whatsappNumber = whatsappDigits.startsWith("0")
    ? `62${whatsappDigits.slice(1)}`
    : whatsappDigits;
  response.setHeader("Cache-Control", "no-store");

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return response.status(503).json({
      error: "Konfigurasi Supabase belum diisi di environment Vercel.",
    });
  }

  return response.status(200).json({
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
    whatsappNumber,
  });
};
