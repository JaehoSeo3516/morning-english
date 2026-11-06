// Supabase 연결 설정 (로그인·기록 동기화용)
// ★ 여기에는 공개해도 되는 anon(또는 publishable) 키만 넣으세요.
//   service_role / secret 키는 절대 넣으면 안 됩니다.
// 비워 두면 동기화 기능 없이 기존처럼 이 브라우저에만 기록이 저장됩니다.
window.ME_CONFIG = {
  supabaseUrl: "https://ztcgjsofnpwnjtfdcvkq.supabase.co",
  supabaseKey: "sb_publishable_BIM49lY4Zh12PqdncXl4ew_ivRphRig",
  // 가입 확인·비밀번호 재설정 메일의 링크가 열릴 주소 (배포한 사이트 주소)
  siteUrl: "https://morning-english-sage.vercel.app"
};
