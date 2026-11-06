#!/usr/bin/env bash
# Windows 실행 파일(MorningEnglish.exe) 빌드 스크립트
# 필요: mingw-w64 (Ubuntu: sudo apt install gcc-mingw-w64-x86-64), python3
# 사용: bash windows/build.sh   → windows/build/MorningEnglish.exe
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd .. && pwd)"
mkdir -p build

# 웹 파일 목록을 exe 리소스로 넣기 위한 files.h / res.rc 생성
python3 - "$ROOT" <<'PY'
import os, sys
root = sys.argv[1]
files = ["index.html", "app.js", "style.css", "favicon.png", "apple-touch-icon.png"] + ["data/" + f for f in sorted(os.listdir(root + "/data")) if f.endswith(".js")]
h = ["typedef struct { int id; const wchar_t *name; } AppFile;", "static const AppFile FILES[] = {"]
rc = ['#include <winver.h>', '1 ICON "app.ico"', '1 24 "app.manifest"']
for i, f in enumerate(files):
    h.append(f'  {{ {100 + i}, L"{f.replace("/", chr(92) * 2)}" }},')
    rc.append(f'{100 + i} RCDATA "{root}/{f}"')
h += ["};", f"#define FILE_COUNT {len(files)}"]
rc.append("""VS_VERSION_INFO VERSIONINFO
FILEVERSION 1,1,0,0
PRODUCTVERSION 1,1,0,0
FILEOS VOS_NT_WINDOWS32
FILETYPE VFT_APP
BEGIN
  BLOCK "StringFileInfo"
  BEGIN
    BLOCK "041204B0"
    BEGIN
      VALUE "FileDescription", "Morning English - TOEIC & OPIc"
      VALUE "ProductName", "Morning English"
      VALUE "FileVersion", "1.1.0"
      VALUE "ProductVersion", "1.1.0"
      VALUE "OriginalFilename", "MorningEnglish.exe"
    END
  END
  BLOCK "VarFileInfo"
  BEGIN
    VALUE "Translation", 0x0412, 1200
  END
END""")
open("build/files.h", "w").write("\n".join(h) + "\n")
open("build/res.rc", "w").write("\n".join(rc) + "\n")
PY

x86_64-w64-mingw32-windres -c 65001 -I . build/res.rc -O coff -o build/res.o
x86_64-w64-mingw32-gcc -O2 -municode -mwindows -Wall -I build -o build/MorningEnglish.exe launcher.c build/res.o \
  -lshell32 -lole32 -ladvapi32 -luuid -static -s
echo "완료: windows/build/MorningEnglish.exe"
