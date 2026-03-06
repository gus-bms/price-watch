# Docker 배포 가이드

> NestJS 백엔드 + React/Vite 프론트엔드 + MySQL을 Docker Compose로 한 번에 실행하는 방법을 설명합니다.

---

## 서비스 구조

```
브라우저 (http://공인IP:80)
  └─ nginx (frontend, :80)
       ├─ /        → React SPA 정적 파일
       └─ /api/*   → backend:4000 (Docker 내부 네트워크)
                        └─ mysql:3306 (Docker 내부 네트워크)
```

백엔드 포트(4000)는 외부에 노출되지 않습니다. 브라우저의 모든 API 요청은 nginx가 내부적으로 중계합니다.

---

## 로컬에서 전체 스택 실행

```bash
# 1. 환경변수 파일 생성
cp .env.example .env

# 2. 빌드 & 백그라운드 실행
docker compose up -d --build

# 3. 로그 확인
docker compose logs -f

# 4. 중지
docker compose down
```

접속:

| URL | 설명 |
|-----|------|
| `http://localhost/` | React 앱 |
| `http://localhost/api/items` | 백엔드 API (nginx 프록시) |
| `localhost:3308` | MySQL 직접 접속 (DB 클라이언트용) |

---

## 클라우드 VM 배포

### 1단계 — VM 준비 (Ubuntu 22.04 기준)

```bash
# 패키지 업데이트
sudo apt update && sudo apt upgrade -y

# Docker 설치
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Docker Compose v2 확인
docker compose version
```

### 2단계 — 방화벽 / 보안그룹 설정

클라우드 콘솔에서 **인바운드 규칙**을 추가합니다.

| 포트 | 프로토콜 | 용도 |
|------|----------|------|
| 22 | TCP | SSH |
| 80 | TCP | 프론트엔드 (nginx) |
| 443 | TCP | HTTPS (도메인 연결 시) |

> ⚠️ 포트 4000은 외부에 열지 않아도 됩니다. 백엔드는 Docker 내부 네트워크에서만 동작합니다.

### 3단계 — 코드 배포

```bash
# VM에서 저장소 클론
git clone git@github.com:gus-bms/price-watch.git
cd price-watch

# 환경변수 파일 생성
cp .env.example .env
nano .env
```

VM용 `.env` 핵심 항목:

```env
# DB_HOST는 반드시 Docker 서비스명으로 설정 (127.0.0.1 사용 불가)
DB_HOST=mysql
DB_PORT=3308
DB_USER=price_watch
DB_PASSWORD=강한비밀번호로변경
DB_NAME=price_watch
DB_CONNECTION_LIMIT=10

APP_HOST=0.0.0.0
APP_PORT=4000

UI_PORT=80
DB_ROOT_PASSWORD=강한루트비밀번호로변경
```

> ⚠️ `DB_HOST=mysql` — 컨테이너 안에서 MySQL을 찾는 이름입니다. `127.0.0.1`로 설정하면 연결에 실패합니다.

### 4단계 — 빌드 & 실행

```bash
docker compose up -d --build

# 상태 확인
docker compose ps

# 실시간 로그
docker compose logs -f
```

### 5단계 — 접속 확인

```
http://서버공인IP/          → React 앱
http://서버공인IP/api/items  → 백엔드 API
```

---

## CI/CD — GitHub Actions

### ci.yml (자동 품질 검사)

`feat/**`, `main` 브랜치에 push하거나 PR을 열면 자동 실행됩니다.

| 단계 | 내용 |
|------|------|
| `backend-typecheck` | TypeScript 타입 검사 |
| `frontend-build` | TypeScript 검사 + Vite 빌드 |
| `docker-build` | 두 이미지 빌드 검증 (push 없음) |

### docker-publish.yml (자동 이미지 배포)

`v*.*.*` 형식의 태그를 push하면 GitHub Container Registry(`ghcr.io`)에 이미지를 자동으로 올립니다.

```bash
git tag v1.0.0
git push origin v1.0.0
```

배포되는 이미지:

```
ghcr.io/gus-bms/price-watch-backend:v1.0.0
ghcr.io/gus-bms/price-watch-backend:latest
ghcr.io/gus-bms/price-watch-frontend:v1.0.0
ghcr.io/gus-bms/price-watch-frontend:latest
```

### AWS EC2 자동 재배포

이 저장소에는 `main` 브랜치 push 시 EC2를 자동 재배포하는 workflow
`.github/workflows/deploy-aws.yml` 이 포함되어 있습니다.

동작 방식:

1. GitHub-hosted runner가 `linux/amd64` 백엔드/프론트 이미지를 빌드
2. 이미지 archive와 배포 파일을 EC2 `~/price-watch-deploy` 로 전송
3. EC2에서 `redeploy.sh` 실행
4. `mysql` 기동 → 인증 스키마 마이그레이션 적용 → `backend/frontend` 재생성

사전 조건:

- EC2에 Docker와 Docker Compose가 설치되어 있어야 함
- 서버의 `~/price-watch-deploy/.env` 가 미리 준비되어 있어야 함
- 보안 그룹에서 `22`, `80` 포트 허용

GitHub 저장소 → Settings → Secrets and variables → Actions 에 등록:

| Secret 이름 | 값 |
|-------------|-----|
| `EC2_HOST` | 서버 공인 IP |
| `EC2_USER` | SSH 접속 유저명 (예: `ec2-user`) |
| `EC2_SSH_KEY` | EC2 접속용 PEM 개인키 전체 내용 |
| `KAKAO_CLIENT_ID` | 프론트 빌드에 주입할 카카오 REST API 키 |

---

## 유용한 명령어

```bash
# 특정 서비스 로그만 보기
docker compose logs -f backend
docker compose logs -f frontend

# 서비스 재시작
docker compose restart backend

# 컨테이너 내부 접속
docker compose exec backend sh
docker compose exec mysql mysql -u price_watch -p

# 이미지 재빌드 (코드 변경 후)
docker compose up -d --build backend

# 전체 정리 (볼륨 포함 — DB 데이터 삭제됨)
docker compose down -v
```

---

## 환경변수 전체 목록

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `DB_HOST` | `127.0.0.1` | DB 호스트 (Docker 사용 시 `mysql`) |
| `DB_PORT` | `3308` | 호스트에서 MySQL에 접근하는 포트 |
| `DB_USER` | `price_watch` | DB 유저 |
| `DB_PASSWORD` | `price_watch_dev` | DB 비밀번호 |
| `DB_NAME` | `price_watch` | DB 이름 |
| `DB_CONNECTION_LIMIT` | `10` | 커넥션 풀 최대 개수 |
| `APP_HOST` | `0.0.0.0` | API 서버 바인딩 주소 |
| `APP_PORT` | `4000` | API 서버 포트 |
| `UI_PORT` | `80` | 프론트엔드(nginx) 호스트 포트 |
| `DB_ROOT_PASSWORD` | `root` | MySQL root 비밀번호 (Docker 전용) |
