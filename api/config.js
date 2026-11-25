module.exports = (_request, response) => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, WHATSAPP_NUMBER = "" } = process.env;
  response.setHeader("Cache-Control", "no-store");

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return response.status(503).json({
      error: "Konfigurasi Supabase belum diisi di environment Vercel.",
    });
  }

  return response.status(200).json({
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
    whatsappNumber: WHATSAPP_NUMBER,
  });
};
