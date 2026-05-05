/**
 * Supabase — لازم يكون فيه url و anonKey مع بعض.
 *
 * anonKey = من Supabase → Settings → API → Project API keys → anon public
 * (مفتاح طويل يبلش بـ eyJ...) — إذا تركته فاضي "" الموقع ما بيتصل بـ Supabase أبداً
 * وزر Save بالأدمن ما بيحفظ بالسحابة (يبقى الحفظ محلياً على نفس الجهاز فقط).
 *
 * storageBucket = نفس اسم الـ bucket في Supabase → Storage (افتراضي portfolio-images).
 * لازم تنشئ الـ bucket من الواجهة أو SQL كما في SUPABASE_SETUP.sql القسم (3).
 *
 * skipStorageUpload = true → تعطيل رفع الصور لـ Supabase Storage (مسار imges/ أو نسخ محلي فقط).
 * false = رفع تلقائي للسحابة عند اختيار صورة (لازم bucket portfolio-images + سياسات SQL).
 */
window.PORTFOLIO_SUPABASE = {
  url: "https://zcbiyxgfezihoxzauysw.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjYml5eGdmZXppaG94emF1eXN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NzYyNTEsImV4cCI6MjA5MzQ1MjI1MX0.WAZstxkP-OnDPp4XVsa1AavwthZ74wEG52SXHM65K84",
  storageBucket: "portfolio-images",
  skipStorageUpload: false,
};
