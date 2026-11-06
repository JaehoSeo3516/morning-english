// Morning English 실행기
// Windows에 기본 설치된 Microsoft Edge(없으면 Chrome)를 '앱 모드'로 띄워
// 주소창 없는 독립 창으로 Morning English를 실행합니다.
#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif
#include <windows.h>
#include <shlobj.h>
#include <shellapi.h>
#include <wchar.h>
#include "files.h"

static void join(wchar_t *out, size_t n, const wchar_t *a, const wchar_t *b) {
  _snwprintf(out, n, L"%ls\\%ls", a, b);
  out[n - 1] = 0;
}

static BOOL exists(const wchar_t *p) {
  DWORD a = GetFileAttributesW(p);
  return a != INVALID_FILE_ATTRIBUTES && !(a & FILE_ATTRIBUTE_DIRECTORY);
}

// 프로그램 안에 넣어 둔 앱 파일들을 root 폴더에 풀어 놓음
static BOOL extract(const wchar_t *root) {
  for (int i = 0; i < FILE_COUNT; i++) {
    HRSRC r = FindResourceW(NULL, MAKEINTRESOURCEW(FILES[i].id), MAKEINTRESOURCEW(10)); // RT_RCDATA
    if (!r) return FALSE;
    HGLOBAL g = LoadResource(NULL, r);
    const void *data = LockResource(g);
    DWORD size = SizeofResource(NULL, r);
    wchar_t path[MAX_PATH * 2], dir[MAX_PATH * 2];
    join(path, MAX_PATH * 2, root, FILES[i].name);
    wcscpy(dir, path);
    wchar_t *slash = wcsrchr(dir, L'\\');
    if (slash) { *slash = 0; SHCreateDirectoryExW(NULL, dir, NULL); }
    HANDLE h = CreateFileW(path, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    if (h == INVALID_HANDLE_VALUE) return FALSE;
    DWORD w = 0;
    BOOL ok = WriteFile(h, data, size, &w, NULL) && w == size;
    CloseHandle(h);
    if (!ok) return FALSE;
  }
  return TRUE;
}

// 레지스트리(App Paths)와 기본 설치 경로에서 브라우저 찾기
static BOOL find_browser(const wchar_t *exe, wchar_t *out, DWORD n) {
  wchar_t key[256];
  _snwprintf(key, 256, L"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\%ls", exe);
  HKEY roots[2] = { HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE };
  for (int i = 0; i < 2; i++) {
    DWORD sz = n * sizeof(wchar_t);
    if (RegGetValueW(roots[i], key, NULL, RRF_RT_REG_SZ, NULL, out, &sz) == ERROR_SUCCESS && exists(out)) return TRUE;
  }
  const wchar_t *guess[] = {
    L"%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe",
    L"%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe",
    L"%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe",
    L"%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe",
    L"%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe",
  };
  for (int i = 0; i < 5; i++) {
    if (wcsstr(guess[i], exe) && ExpandEnvironmentStringsW(guess[i], out, n) && exists(out)) return TRUE;
  }
  return FALSE;
}

// C:\폴더\index.html → file:///C:/%ED%8F%B4%EB%8D%94/index.html
static void to_file_url(const wchar_t *path, wchar_t *out, size_t n) {
  char u8[MAX_PATH * 4];
  int len = WideCharToMultiByte(CP_UTF8, 0, path, -1, u8, sizeof u8, NULL, NULL);
  size_t o = 0;
  o += _snwprintf(out, n, L"file:///");
  for (int i = 0; i < len - 1 && o + 4 < n; i++) {
    unsigned char c = (unsigned char)u8[i];
    if (c == '\\') out[o++] = L'/';
    else if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || strchr("-_.~/:", c)) out[o++] = c;
    else o += _snwprintf(out + o, n - o, L"%%%02X", c);
  }
  out[o] = 0;
}

int WINAPI wWinMain(HINSTANCE hi, HINSTANCE hp, LPWSTR cmd, int show) {
  wchar_t exeDir[MAX_PATH], base[MAX_PATH], appDir[MAX_PATH * 2], profile[MAX_PATH * 2], index[MAX_PATH * 2];
  GetModuleFileNameW(NULL, exeDir, MAX_PATH);
  *wcsrchr(exeDir, L'\\') = 0;

  wchar_t *la = NULL;
  if (FAILED(SHGetKnownFolderPath(&FOLDERID_LocalAppData, 0, NULL, &la))) {
    MessageBoxW(NULL, L"사용자 폴더를 찾을 수 없어요.", L"Morning English", MB_ICONERROR);
    return 1;
  }
  join(base, MAX_PATH, la, L"MorningEnglish");
  CoTaskMemFree(la);
  SHCreateDirectoryExW(NULL, base, NULL);
  join(profile, MAX_PATH * 2, base, L"profile");

  // 실행 파일 옆에 app 폴더가 있으면 그걸 사용 (문제를 직접 추가하고 싶을 때)
  join(appDir, MAX_PATH * 2, exeDir, L"app");
  join(index, MAX_PATH * 2, appDir, L"index.html");
  if (!exists(index)) {
    join(appDir, MAX_PATH * 2, base, L"app");
    if (!extract(appDir)) {
      MessageBoxW(NULL, L"앱 파일을 준비하지 못했어요. 디스크 공간과 권한을 확인해 주세요.", L"Morning English", MB_ICONERROR);
      return 1;
    }
    join(index, MAX_PATH * 2, appDir, L"index.html");
  }

  wchar_t url[MAX_PATH * 12], browser[MAX_PATH * 2], cmdline[MAX_PATH * 20];
  to_file_url(index, url, sizeof url / sizeof *url);

  if (!find_browser(L"msedge.exe", browser, MAX_PATH * 2) && !find_browser(L"chrome.exe", browser, MAX_PATH * 2)) {
    MessageBoxW(NULL, L"Microsoft Edge나 Chrome을 찾지 못해 기본 브라우저로 열어요.\n(녹음과 기록 저장은 브라우저에 따라 다를 수 있어요.)",
                L"Morning English", MB_ICONINFORMATION);
    ShellExecuteW(NULL, L"open", index, NULL, NULL, SW_SHOWNORMAL);
    return 0;
  }

  // 전용 프로필(user-data-dir)을 써서 기록이 평소 브라우저와 섞이지 않고, 브라우저 데이터를 지워도 유지됨
  _snwprintf(cmdline, sizeof cmdline / sizeof *cmdline,
             L"\"%ls\" --app=\"%ls\" --user-data-dir=\"%ls\" --no-first-run --no-default-browser-check "
             L"--disable-features=Translate --window-size=820,940",
             browser, url, profile);
  cmdline[sizeof cmdline / sizeof *cmdline - 1] = 0;

  STARTUPINFOW si = { sizeof si };
  PROCESS_INFORMATION pi;
  if (!CreateProcessW(NULL, cmdline, NULL, NULL, FALSE, 0, NULL, NULL, &si, &pi)) {
    ShellExecuteW(NULL, L"open", index, NULL, NULL, SW_SHOWNORMAL);
    return 0;
  }
  CloseHandle(pi.hThread);
  CloseHandle(pi.hProcess);
  return 0;
}
