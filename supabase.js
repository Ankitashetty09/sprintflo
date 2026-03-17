const SUPABASE_URL = "https://fmlawoozyemazdtrsrgb.supabase.co";
const SUPABASE_KEY = "sb_publishable_Yrpuqnsl21crfWPM2Unj9w_dxWxHbov";

if (!window.supabaseClient) {
  window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );
}

console.log("SprintFlo connected to Supabase");


