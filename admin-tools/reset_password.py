"""SKW owner password reset. Run in Google Cloud Shell; no extra packages."""
import getpass
import json
import re
import subprocess
import sys
import urllib.request
import urllib.error

PROJECT = "sktelecom-w"
OWNER = "sonices123@gmail.com"

def reset(username, password, call):
    username = username.strip().lower()
    if not re.fullmatch(r"[a-z0-9][a-z0-9._-]{1,49}", username):
        raise ValueError("아이디 형식을 확인해주세요.")
    if len(password) < 6:
        raise ValueError("비밀번호는 6자 이상이어야 합니다.")
    email = username + "@accounts.skw.invalid"
    users = call("lookup", {"email": [email]}).get("users", [])
    if len(users) != 1 or users[0].get("email", "").lower() != email:
        raise ValueError("일치하는 계정이 없습니다.")
    user = users[0]
    if not any(p.get("providerId") == "password" for p in user.get("providerUserInfo", [])):
        raise ValueError("아이디/비밀번호 계정만 초기화할 수 있습니다.")
    result = call("update", {"localId": user["localId"], "password": password})
    if result.get("localId") != user["localId"]:
        raise ValueError("처리 결과를 확인하지 못했습니다. 재로그인으로 확인해주세요.")

def main():
    if not sys.stdin.isatty():
        raise ValueError("대화형 터미널에서 실행해주세요.")
    # Explicit owner Google account; no service-account keys or browser credentials.
    token = subprocess.run(
        ["gcloud", "auth", "print-access-token", "--account=" + OWNER],
        check=True, capture_output=True, text=True
    ).stdout.strip()
    if not token:
        raise ValueError("관리자 Google 로그인이 필요합니다.")
    def call(method, payload):
        request = urllib.request.Request(
            "https://identitytoolkit.googleapis.com/v1/projects/" + PROJECT + "/accounts:" + method,
            data=json.dumps(payload).encode(),
            headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
            method="POST"
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            # Do not print response bodies, credentials, or request payloads.
            raise ValueError("Firebase 요청 실패 (HTTP " + str(error.code) + "). 계정 권한과 비밀번호 정책을 확인해주세요.") from None
    username = input("초기화할 사용자 아이디: ").strip()
    print("프로젝트: " + PROJECT + " / 대상: " + username.lower())
    if input("본인 확인을 마쳤고 이 계정의 비밀번호를 초기화하려면 RESET 입력: ") != "RESET":
        print("취소했습니다.")
        return
    password = getpass.getpass("새 임시 비밀번호 (화면에 표시되지 않음): ")
    confirmation = getpass.getpass("임시 비밀번호 다시 입력: ")
    if password != confirmation:
        raise ValueError("비밀번호 확인 값이 일치하지 않습니다.")
    reset(username, password, call)
    print("초기화 완료. 사용자에게 임시 비밀번호를 별도로 전달하고 로그인 후 변경하도록 안내해주세요.")

if __name__ == "__main__":
    try:
        main()
    except (ValueError, subprocess.CalledProcessError, FileNotFoundError, urllib.error.URLError):
        print("초기화를 완료하지 못했습니다. 입력값, 관리자 Google 로그인, Firebase IAM 권한과 연결을 확인해주세요.", file=sys.stderr)
        sys.exit(1)
    except (KeyboardInterrupt, EOFError):
        print("\n취소했습니다.")
