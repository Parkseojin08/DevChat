# multer 사용 가이드 (DevChat)

이 문서는 DevChat 백엔드에서 **multer**를 어떻게 도입했고, 왜 그렇게 작성했는지를 정리한다.

---

## 1. multer란 무엇인가

`multer`는 Node.js / Express용 미들웨어로, **`multipart/form-data` 요청을 파싱해 파일과 일반 필드를 분리**해주는 라이브러리다.

- `express.json()`은 `application/json` 만 파싱한다. 파일 업로드 표준 인코딩인 `multipart/form-data`는 Express 기본 파서가 못 다룬다.
- multer가 이 빈자리를 메운다.

요청을 받으면 multer는:

- 파일 파트 → `req.file` (단일 업로드) 또는 `req.files` (다중)에 객체로 채워줌
- 텍스트 파트 → `req.body`에 일반 필드처럼 채워줌

파일 객체의 주요 필드:

| 필드 | 의미 |
|---|---|
| `fieldname` | form의 `name` 속성 (예: `'profile_image'`) |
| `originalname` | 클라이언트가 보낸 파일명 |
| `mimetype` | MIME 타입 (예: `'image/png'`) |
| `size` | 바이트 단위 크기 |
| `buffer` | **memoryStorage 일 때만** 파일 바이너리(Buffer) |
| `path` | **diskStorage 일 때만** 저장 경로 |

---

## 2. 기본 사용법

### 설치

```bash
npm install multer
```

### Storage 모드 두 가지

1. **`multer.diskStorage`** — multer가 직접 디스크에 파일을 쓴다. `req.file.path`로 경로를 받음.
2. **`multer.memoryStorage`** — 파일을 메모리(Buffer)에만 올린다. 디스크 저장은 직접 처리.

DevChat은 **memoryStorage**를 사용한다 → 다음 절에서 이유 설명.

### 최소 예시

```js
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// 단일 파일: form-data의 'profile_image' 필드 1개를 받음
app.post('/upload', upload.single('profile_image'), (req, res) => {
  console.log(req.file);   // { fieldname, mimetype, buffer, ... }
  console.log(req.body);   // 다른 텍스트 필드들
  res.json({ ok: true });
});
```

### 주요 옵션

| 옵션 | 설명 |
|---|---|
| `storage` | `diskStorage` 또는 `memoryStorage` |
| `limits.fileSize` | 파일 크기 상한 (바이트). 초과 시 `LIMIT_FILE_SIZE` 에러 |
| `fileFilter(req, file, cb)` | 업로드 허용 여부 결정. `cb(null, true/false)` 또는 `cb(err)` |

### 업로드 메서드

| 메서드 | 용도 |
|---|---|
| `upload.single('name')` | `name` 필드의 단일 파일 → `req.file` |
| `upload.array('name', maxCount)` | `name` 필드의 여러 파일 → `req.files` |
| `upload.fields([{ name, maxCount }, ...])` | 여러 필드명에 걸친 다중 업로드 |
| `upload.none()` | 파일 없이 텍스트 필드만 받음 |

### multer가 던지는 에러 코드

| 코드 | 의미 |
|---|---|
| `LIMIT_FILE_SIZE` | `limits.fileSize` 초과 |
| `LIMIT_FILE_COUNT` | 파일 수 초과 |
| `LIMIT_UNEXPECTED_FILE` | 정의되지 않은 필드명으로 파일 도착 |
| `LIMIT_FIELD_*` | 필드 개수/크기 초과 |

이 에러들은 일반 Error로 throw되므로, 별도 처리로 우리 프로젝트의 `AppError`로 변환해야 한다.

---

## 3. DevChat 프로젝트에서의 사용 방식

DevChat은 multer를 **얇은 1차 입력 검증/파싱 계층**으로만 쓰고, 실제 디스크 저장은 **서비스 계층(`storage.js`)이 따로 담당**한다. 책임 분리(`CLAUDE.md`의 계층 원칙)에 맞추기 위함이다.

### 3-1. 파일 구조

```
server/src/
├── middlewares/upload.js   # multer 설정 + 에러 래퍼
├── services/storage.js     # 실제 파일 저장/삭제 (디스크 I/O)
├── controllers/auth.js     # req.file을 받아 service로 위임
├── services/auth.js        # profileFile.buffer를 storage로 전달
└── routes/auth.js          # wrapUpload(upload.single('profile_image')) 적용
```

업로드 파일이 실제로 저장되는 위치: `server/uploads/profile/<uuid>.<ext>`
정적 서빙 경로: `/uploads/profile/<filename>` (`index.js`에서 `express.static`으로 노출)

### 3-2. `middlewares/upload.js` — multer 설정

```js
const multer = require('multer');
const { ValidationError } = require('../errors/AppError');

const ALLOWED_MIMETYPES = new Set(['image/jpeg','image/jpg','image/png','image/webp']);
const FILE_SIZE_LIMIT   = 5 * 1024 * 1024; // 5MB

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: FILE_SIZE_LIMIT },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIMETYPES.has(file.mimetype)) cb(null, true);
        else cb(new ValidationError(
            'INVALID_FILE',
            '허용되지 않는 파일 형식입니다. jpg, png, webp만 업로드 가능합니다.'
        ));
    }
});
```

**설계 결정 포인트:**

- **memoryStorage 채택**: 디스크 경로/파일명 규칙·롤백 로직을 **service 계층(`storage.js`)에 일원화**하려고 일부러 메모리로만 받음. multer가 디스크에 쓰게 두면 service가 multer가 만든 파일명·경로를 알아야 해서 결합도가 올라간다.
- **MIME 화이트리스트**: jpg/png/webp만. fileFilter 단계에서 차단해 그 이후 로직에 다른 형식이 흘러들지 않게 함.
- **5MB 제한**: 프로필 이미지 용도이므로 충분.
- **fileFilter에서 `ValidationError`를 그대로 cb로 넘김**: 우리 표준 에러 객체를 그대로 errorHandler까지 흘려보내기 위함.

### 3-3. `wrapUpload` — 에러 변환 래퍼

multer가 던지는 고유 에러 코드(`LIMIT_FILE_SIZE` 등)를 우리 프로젝트의 `AppError`로 변환하는 래퍼다.

```js
exports.wrapUpload = (multerMiddleware) => (req, res, next) => {
    multerMiddleware(req, res, (err) => {
        if (!err) return next();

        if (err.code === 'LIMIT_FILE_SIZE') {
            return next(new ValidationError('FILE_TOO_LARGE', '파일 크기는 5MB를 초과할 수 없습니다.'));
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return next(new ValidationError('INVALID_FILE', '예상치 못한 파일 필드입니다.'));
        }
        next(err); // fileFilter에서 넘긴 ValidationError 또는 기타 에러 통과
    });
};
```

**왜 래핑하나:**

- multer 원시 에러는 `statusCode`가 없어 `errorHandler`가 500으로 처리해버린다.
- 사용자에게 보여줄 한글 메시지(`'파일 크기는 5MB를 초과할 수 없습니다.'`)와 프론트 분기용 code(`FILE_TOO_LARGE`)를 표준화하기 위함.

### 3-4. `routes/auth.js` — 라우트에 부착

```js
const { upload, wrapUpload } = require('../middlewares/upload');

// 'profile_image' 필드의 단일 파일을 받는 미들웨어
const uploadProfileImage = wrapUpload(upload.single('profile_image'));

routes.post('/signup', uploadProfileImage, controllers.signUp);
routes.patch('/me', authenticate, uploadProfileImage, controllers.profileUpdate);
```

- 회원가입과 프로필 편집에서 동일하게 사용.
- **순서 중요**: `authenticate` 미들웨어 뒤에 `uploadProfileImage`를 둠. 인증 안 된 요청이 파일을 메모리에 올리지 못하게.

### 3-5. `controllers/auth.js` — `req.file` 수령

```js
exports.signUp = async (req, res, next) => {
    try {
        const { handle, email, name, password, birth_date } = req.body || {};
        const profileFile = req.file; // multer가 파싱한 파일 객체 (없으면 undefined)

        // ... 형식 검증 ...

        await authService.signUp({ handle, email, name, password, birth_date, profileFile });

        return res.status(201).json({ data: { success: true, message: '회원가입을 성공하였습니다.' } });
    } catch (err) { next(err); }
};
```

- multer 덕분에 텍스트(`req.body`)와 파일(`req.file`)을 동시에 받을 수 있음.
- 컨트롤러는 파일을 **검증하지 않는다** — multer의 fileFilter/limits가 이미 처리.
- 컨트롤러는 그저 `profileFile`을 service에 전달.

### 3-6. `services/auth.js` — `buffer`를 storage로 위임

```js
if (profileFile) {
    try {
        const profile_image = await storage.saveProfileImage(
            profileFile.buffer,
            profileFile.mimetype
        );
        await userRepo.updateProfile(inserted.id, { profile_image });
    } catch (fileErr) {
        // 파일 저장 실패 → 방금 insert한 user row 롤백
        await userRepo.deleteById(inserted.id);
        throw fileErr;
    }
}
```

- 흐름: **DB insert(profile_image=null) → 파일 저장 → DB update(profile_image=URL)**.
- 파일 I/O가 실패하면 DB row를 롤백해 orphan 방지.
- 프로필 편집(`updateProfile`)에서는 추가로: 새 파일 저장 성공 후 DB 업데이트 성공해야 **기존 파일 삭제**. DB 실패 시 새로 저장한 파일 삭제.

### 3-7. `services/storage.js` — 실제 디스크 저장

```js
exports.saveProfileImage = async (fileBuffer, mimetype) => {
    const ext = ALLOWED_MIME[mimetype];           // 다시 한번 화이트리스트 체크
    if (!ext) throw new ValidationError('INVALID_FILE', '...');

    const filename = `${crypto.randomUUID()}.${ext}`;
    const filepath = path.join(PROFILE_DIR, filename);

    await fsp.writeFile(filepath, fileBuffer);
    return `/uploads/profile/${filename}`;        // DB에 저장될 상대 URL
};
```

- 파일명은 `crypto.randomUUID()`로 생성 → 원본 파일명에 의존 안 함 (경로 트래버설/중복 방지).
- multer는 mimetype까지만 알려주고, **확장자는 service가 mimetype으로부터 결정** (originalname 신뢰 X).
- 삭제(`deleteProfileImage`)는 `/uploads/profile/` prefix 검사 + `..` 차단으로 경로 트래버설 방어.

---

## 4. 전체 흐름 요약

```
[클라이언트]
  POST /auth/signup  (Content-Type: multipart/form-data)
   ├ handle, email, password, ...  (text 필드)
   └ profile_image: <binary>       (file 필드)
        │
        ▼
[wrapUpload(upload.single('profile_image'))]
  ├ MIME 화이트리스트 / 5MB 제한 검사
  ├ 통과 → req.file = { buffer, mimetype, ... }, req.body = { 텍스트... }
  └ 실패 → ValidationError로 변환 → errorHandler → 400 응답
        │
        ▼
[controller.signUp]
  ├ req.body 형식 검증 (Zod 대신 정규식)
  └ service.signUp({ ..., profileFile: req.file })
        │
        ▼
[service.signUp]
  ├ 비즈니스 검증 (handle/email 중복) → 통과 시 user insert
  ├ profileFile 있으면 storage.saveProfileImage(buffer, mimetype)
  │     └ uploads/profile/<uuid>.<ext>로 저장 후 URL 반환
  ├ userRepo.updateProfile(id, { profile_image: URL })
  └ 실패 시 user row 롤백
        │
        ▼
[정적 서빙]
  GET /uploads/profile/<uuid>.jpg  →  express.static이 응답
```

---

## 5. 핵심 설계 원칙 (왜 이렇게 짰나)

1. **multer는 "입력 파서"로만** — 디스크 저장 책임을 service로 빼서 트랜잭션/롤백 로직과 한 곳에서 관리.
2. **에러 형식 통일** — multer 고유 에러를 `wrapUpload`로 `AppError`로 변환해, 어디서 발생한 에러든 동일한 응답 구조로 나가게.
3. **다층 방어** — fileFilter(MIME), limits(크기), storage.js(MIME 재검사 + 파일명 화이트리스트)로 중첩 검증.
4. **경로 트래버설 차단** — 파일명은 UUID, 삭제는 prefix 검사 + `..` 차단.
5. **원본 파일명·확장자 불신** — 클라이언트가 보낸 `originalname`은 무시, 항상 mimetype으로부터 확장자 도출.