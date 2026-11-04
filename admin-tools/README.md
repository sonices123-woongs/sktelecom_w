# 관리자 비밀번호 초기화

이 도구는 앱의 사용자 관리 권한과 별개로, Firebase 프로젝트 IAM 권한이 있는 소유자 Google 계정으로 실행합니다.
현재 운영 앱에는 사용자 관리 화면 상단의 비밀번호 초기화 버튼이 제공됩니다. 이 Cloud Shell 도구는 비상용 대체 수단입니다. 사용자 비밀번호나 서비스 계정 키를 저장소에 넣지 마세요.

## 실행 (별도 설치가 필요 없는 Google Cloud Shell 권장)

1. https://console.cloud.google.com/ 에서 sonices123@gmail.com 계정으로 로그인합니다.
2. 프로젝트 sktelecom-w를 선택하고 상단 Cloud Shell (>_)을 엽니다.
3. 아래 명령을 실행합니다. 이미 sktelecom_w 폴더가 있으면 기존 폴더에서 git pull 후 마지막 명령만 실행합니다.

```bash
git clone https://github.com/sonices123-woongs/sktelecom_w.git
cd sktelecom_w
python3 admin-tools/reset_password.py
```

4. 대상 아이디를 입력하고 확인한 뒤 RESET을 입력합니다.
5. 임시 비밀번호를 두 번 입력합니다. 입력값은 터미널에 표시되지 않습니다.
6. 완료 메시지가 나온 뒤 임시 비밀번호를 본인 확인된 사용자에게 별도로 전달합니다.
7. 사용자는 앱 로그인 후 비밀번호 변경을 눌러 자신만 아는 값으로 변경합니다.

현재 자동으로 비밀번호 변경을 강제하지는 않습니다.
기존 UID를 그대로 사용하고 비밀번호 필드만 바꾸므로 기존 권한과 연결 자료를 유지합니다.
계정을 삭제하고 다시 만들 필요가 없습니다.
Google 로그인 관리자 계정은 이 도구의 대상이 아닙니다.

실제 계정 초기화는 관리자 Google 인증과 프로젝트의 firebaseauth.users.get / firebaseauth.users.update 권한이 있어야 완료됩니다.
구문 검사 및 모의 API 검증을 마쳤으며 실제 Firebase 초기화는 소유자 로그인 후 확인해야 합니다.
