# API Specifications
# ختمة — Khatma Platform

**Base URL:** `https://api.khatma.app/v1`  
**Auth:** Bearer JWT (except public endpoints)  
**Content-Type:** `application/json`  
**Rate Limits:** See per-endpoint notes  

---

## 1. Authentication APIs

### POST /auth/register
**Rate Limit:** 5 req/IP/hour  

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "displayName": "أحمد محمد",
  "phone": "+966501234567"  // optional
}
```

**Validation:**
- `email`: valid email format, unique
- `password`: min 8 chars, 1 uppercase, 1 number, 1 special char
- `displayName`: 2–50 chars, no scripts
- `phone`: E.164 format (optional)

**Response 201:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clxxx",
      "displayName": "أحمد محمد",
      "email": "user@example.com",
      "role": "USER"
    },
    "accessToken": "eyJ...",
    "expiresIn": 900
  },
  "message": "تم إنشاء الحساب بنجاح"
}
```

**Errors:**
| Code | Status | Message |
|------|--------|---------|
| EMAIL_EXISTS | 409 | البريد الإلكتروني مستخدم |
| PHONE_EXISTS | 409 | رقم الهاتف مستخدم |
| WEAK_PASSWORD | 422 | كلمة المرور ضعيفة |
| INVALID_EMAIL | 422 | بريد إلكتروني غير صالح |

---

### POST /auth/login
**Rate Limit:** 10 req/IP/15min  

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "displayName": "...", "role": "USER" },
    "accessToken": "eyJ...",
    "expiresIn": 900
  }
}
```
_Note: Refresh token set as httpOnly cookie automatically_

**Errors:**
| Code | Status | Message |
|------|--------|---------|
| INVALID_CREDENTIALS | 401 | بيانات الدخول غير صحيحة |
| ACCOUNT_SUSPENDED | 403 | الحساب موقوف |
| TOO_MANY_ATTEMPTS | 429 | محاولات كثيرة، انتظر 15 دقيقة |

---

### POST /auth/refresh
**Rate Limit:** 30 req/user/hour  
**Auth:** httpOnly cookie (refresh_token)  

**Response 200:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "expiresIn": 900
  }
}
```

---

### POST /auth/logout
**Auth:** Required  

**Response 200:**
```json
{ "success": true, "message": "تم تسجيل الخروج" }
```

---

### POST /auth/send-otp
**Rate Limit:** 3 req/phone/10min  

**Request:**
```json
{ "phone": "+966501234567", "purpose": "LOGIN" }
```

**Purposes:** `LOGIN`, `REGISTER`, `RESET_PASSWORD`, `VERIFY_PHONE`

---

### POST /auth/verify-otp
**Rate Limit:** 5 attempts/code  

**Request:**
```json
{ "phone": "+966501234567", "otp": "123456", "purpose": "LOGIN" }
```

---

## 2. User APIs

### GET /users/me
**Auth:** Required  

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "clxxx",
    "displayName": "أحمد محمد",
    "email": "user@example.com",
    "phone": "+966501234567",
    "avatarUrl": "https://cdn.khatma.app/avatars/xxx.jpg",
    "role": "USER",
    "stats": {
      "totalKhatmasJoined": 5,
      "totalPartsCompleted": 47,
      "totalKhatmasCompleted": 2
    }
  }
}
```

---

### PATCH /users/me
**Auth:** Required  

**Request:**
```json
{
  "displayName": "أحمد علي",
  "avatarUrl": "https://..."
}
```

---

## 3. Khatma APIs

### POST /khatmas
**Auth:** Required  
**Rate Limit:** 20 khatmas/user/day  

**Request:**
```json
{
  "title": "ختمة رمضان 1446",
  "description": "ختمة جماعية لعائلتنا",
  "type": "COLLECTIVE",
  "visibility": "PRIVATE",
  "requireApproval": false,
  "allowRepeat": false,
  "autoRedistribute": false,
  "isContinuous": false,
  "maxMembers": 30,
  "shareEnabled": true,
  "startDate": "2026-03-01T00:00:00Z",
  "endDate": "2026-03-30T23:59:59Z",
  "groupId": null
}
```

**Validation:**
- `title`: 3–100 chars
- `maxMembers`: 1–1000 (optional)
- `endDate` must be after `startDate` if both provided
- `type`: INDIVIDUAL khatma cannot have maxMembers > 1

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "clyyy",
    "title": "ختمة رمضان 1446",
    "shareCode": "ABC123XY",
    "shareUrl": "https://khatma.app/join/ABC123XY",
    "parts": [
      { "id": "...", "partNumber": 1, "status": "AVAILABLE" },
      ...// 30 parts
    ]
  }
}
```

---

### GET /khatmas
**Auth:** Optional (returns public khatmas if not authed)  

**Query Params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | int | 1 | Page number |
| limit | int | 20 | Max 50 |
| status | enum | ACTIVE | ACTIVE, COMPLETED |
| type | enum | - | INDIVIDUAL, COLLECTIVE |
| q | string | - | Search by title |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [{ "id": "...", "title": "...", "completionPercentage": 45, ... }],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

---

### GET /khatmas/:id
**Auth:** Optional (required if khatma is private)  
**Cache:** 30s Redis cache  

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "clyyy",
    "title": "ختمة رمضان 1446",
    "type": "COLLECTIVE",
    "status": "ACTIVE",
    "visibility": "PUBLIC",
    "completionPercentage": 45,
    "totalParts": 30,
    "completedParts": 13,
    "participantCount": 8,
    "startDate": "2026-03-01",
    "endDate": "2026-03-30",
    "creator": { "id": "...", "displayName": "أحمد" },
    "parts": [
      {
        "id": "...",
        "partNumber": 1,
        "status": "COMPLETED",
        "reservedBy": { "id": "...", "displayName": "علي", "avatarUrl": "..." },
        "completedAt": "2026-03-03T14:30:00Z"
      },
      {
        "id": "...",
        "partNumber": 2,
        "status": "AVAILABLE",
        "reservedBy": null
      }
    ]
  }
}
```

---

### POST /khatmas/:id/join
**Auth:** Required  
**Rate Limit:** 10 join requests/user/hour  

**Request:** (empty body or invitation token)
```json
{ "invitationToken": "abc123" }
```

**Response 200 (direct join):**
```json
{
  "success": true,
  "data": { "participantId": "...", "status": "ACTIVE" },
  "message": "انضممت إلى الختمة بنجاح"
}
```

**Response 202 (requires approval):**
```json
{
  "success": true,
  "data": { "participantId": "...", "status": "PENDING" },
  "message": "طلبك قيد المراجعة"
}
```

**Errors:**
| Code | Status | Message |
|------|--------|---------|
| ALREADY_MEMBER | 409 | أنت عضو بالفعل |
| KHATMA_FULL | 409 | الختمة ممتلئة |
| KHATMA_CLOSED | 403 | الختمة مغلقة |

---

### POST /khatmas/:id/parts/:partId/reserve
**Auth:** Required (must be khatma participant)  
**Rate Limit:** 5 req/user/min  
**Expected Response Time:** < 300ms  

**Request:** (empty body)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "reservationId": "...",
    "partNumber": 5,
    "status": "RESERVED",
    "reservedAt": "2026-03-05T10:00:00Z",
    "dueDate": "2026-03-10T23:59:59Z"
  },
  "message": "تم حجز الجزء الخامس"
}
```

**Errors:**
| Code | Status | Message |
|------|--------|---------|
| PART_NOT_AVAILABLE | 409 | الجزء محجوز |
| ALREADY_HAS_RESERVATION | 409 | لديك جزء محجوز بالفعل |
| NOT_PARTICIPANT | 403 | لست عضواً في هذه الختمة |
| KHATMA_COMPLETED | 422 | الختمة مكتملة |

---

### POST /khatmas/:id/parts/:partId/complete
**Auth:** Required (must be the one who reserved this part)  

**Response 200:**
```json
{
  "success": true,
  "data": {
    "partNumber": 5,
    "status": "COMPLETED",
    "completedAt": "2026-03-08T18:00:00Z",
    "khatmaCompletionPercentage": 50
  },
  "message": "أحسنت! تم تسجيل إتمام الجزء الخامس"
}
```

---

### DELETE /khatmas/:id/leave
**Auth:** Required  

**Response 200:**
```json
{ "success": true, "message": "تم مغادرة الختمة" }
```
_Note: If user has active reservation, it's released first_

---

### POST /khatmas/:id/invite
**Auth:** Required (khatma admin/owner)  

**Request:**
```json
{
  "type": "LINK",
  "expiresInHours": 48
}
// OR
{
  "type": "USER",
  "userId": "clxxx"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "invitationToken": "xyz789",
    "shareUrl": "https://khatma.app/join/xyz789",
    "expiresAt": "2026-03-07T10:00:00Z"
  }
}
```

---

## 4. Group APIs

### POST /groups
**Auth:** Required  
**Rate Limit:** 5 groups/user/day  

**Request:**
```json
{
  "name": "عائلة الحارثي",
  "description": "مجموعة ختمات العائلة",
  "visibility": "PRIVATE",
  "requireApproval": true,
  "maxMembers": 50
}
```

---

### POST /groups/:id/invite
**Auth:** Required (group admin)  

---

### PATCH /groups/:id/members/:userId
**Auth:** Required (group owner/admin)  

**Request:**
```json
{ "role": "ADMIN" }
// OR
{ "status": "SUSPENDED" }
```

---

### DELETE /groups/:id/members/:userId
**Auth:** Required (group owner/admin, or self)  

---

## 5. Notification APIs

### GET /notifications
**Auth:** Required  

**Query:** `?page=1&limit=20&isRead=false`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "...",
        "type": "PART_COMPLETED",
        "title": "إتمام جزء",
        "body": "أتم علي الجزء العاشر في ختمة رمضان",
        "isRead": false,
        "createdAt": "2026-03-05T15:00:00Z",
        "khatmaId": "clyyy"
      }
    ],
    "unreadCount": 3
  }
}
```

---

### PATCH /notifications/mark-all-read
**Auth:** Required  

---

## 6. Admin APIs

### GET /admin/stats
**Auth:** Required (ADMIN role)  

**Response 200:**
```json
{
  "success": true,
  "data": {
    "totalUsers": 12500,
    "activeUsersToday": 3200,
    "totalKhatmas": 890,
    "activeKhatmas": 450,
    "completedKhatmasTotal": 320,
    "totalPartsCompleted": 9600,
    "topKhatmas": [...]
  }
}
```

---

### GET /admin/users
**Auth:** ADMIN  
**Query:** `?page&limit&status&q`

---

### PATCH /admin/users/:id
**Auth:** ADMIN  
**Request:** `{ "status": "SUSPENDED", "reason": "..." }`

---

## 7. WebSocket Events

### Connection
```
Client → connect({ auth: { token: "JWT" } })
Server → connected / error
```

### Joining a Khatma Room
```
Client → emit("join_khatma", { khatmaId: "clyyy" })
Server → emit("khatma_state", { parts: [...], participants: [...] })
```

### Real-time Events (Server → Client)
| Event | Payload | Trigger |
|-------|---------|---------|
| `part_reserved` | `{ partId, partNumber, reservedBy }` | User reserves a part |
| `part_completed` | `{ partId, partNumber, completedBy, khatmaProgress }` | User completes a part |
| `part_released` | `{ partId, partNumber }` | Deadline passed |
| `member_joined` | `{ userId, displayName }` | New participant |
| `member_left` | `{ userId }` | Participant leaves |
| `khatma_completed` | `{ khatmaId, completedAt }` | All 30 parts done |
| `khatma_restarted` | `{ khatmaId, iteration }` | Continuous khatma resets |

---

## 8. Error Response Format

All errors follow this format:
```json
{
  "success": false,
  "error": {
    "code": "PART_NOT_AVAILABLE",
    "message": "الجزء محجوز بالفعل",
    "details": null,
    "timestamp": "2026-03-05T10:00:00Z",
    "path": "/api/v1/khatmas/clyyy/parts/abc/reserve"
  }
}
```

---

## 9. Pagination Format

All list endpoints use cursor-based or offset pagination:
```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

## 10. Rate Limiting Headers

All responses include:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1746460800
Retry-After: 60  (only on 429)
```
