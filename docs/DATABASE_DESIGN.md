# Database Design
# ختمة — Khatma Platform

**Version:** 1.0.0  
**DB Engine:** PostgreSQL 16  
**ORM:** Prisma 5.x  

---

## 1. Entity Relationship Overview

```
Users ──────────┬──── GroupMembers ──── Groups
                │
                ├──── KhatmaParticipants ──── Khatmas ──── QuranParts
                │                                │
                ├──── ReservedParts ─────────────┘
                │
                ├──── Notifications
                ├──── Invitations
                ├──── Sessions
                ├──── Devices
                └──── AuditLogs
```

---

## 2. Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────
// USERS
// ─────────────────────────────────────────

model User {
  id              String    @id @default(cuid())
  email           String?   @unique
  phone           String?   @unique
  passwordHash    String?
  displayName     String
  avatarUrl       String?
  role            UserRole  @default(USER)
  status          UserStatus @default(ACTIVE)
  emailVerified   Boolean   @default(false)
  phoneVerified   Boolean   @default(false)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  deletedAt       DateTime? // Soft delete

  // Relations
  sessions        Session[]
  devices         Device[]
  groupMemberships GroupMember[]
  khatmaParticipations KhatmaParticipant[]
  reservedParts   ReservedPart[]
  createdKhatmas  Khatma[]  @relation("KhatmaCreator")
  createdGroups   Group[]   @relation("GroupCreator")
  notifications   Notification[]
  sentInvitations Invitation[] @relation("InvitationSender")
  receivedInvitations Invitation[] @relation("InvitationReceiver")
  auditLogs       AuditLog[]

  @@index([email])
  @@index([phone])
  @@index([status])
  @@map("users")
}

enum UserRole {
  USER
  MODERATOR
  ADMIN
  SUPER_ADMIN
}

enum UserStatus {
  ACTIVE
  SUSPENDED
  PENDING_VERIFICATION
  DELETED
}

// ─────────────────────────────────────────
// SESSIONS
// ─────────────────────────────────────────

model Session {
  id            String    @id @default(cuid())
  userId        String
  refreshToken  String    @unique
  deviceInfo    String?
  ipAddress     String?
  userAgent     String?
  expiresAt     DateTime
  createdAt     DateTime  @default(now())
  revokedAt     DateTime?

  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([refreshToken])
  @@index([expiresAt])
  @@map("sessions")
}

// ─────────────────────────────────────────
// GROUPS
// ─────────────────────────────────────────

model Group {
  id              String      @id @default(cuid())
  creatorId       String
  name            String
  description     String?
  avatarUrl       String?
  visibility      GroupVisibility @default(PUBLIC)
  requireApproval Boolean     @default(false)
  maxMembers      Int?
  inviteCode      String      @unique @default(cuid())
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  deletedAt       DateTime?

  creator         User        @relation("GroupCreator", fields: [creatorId], references: [id])
  members         GroupMember[]
  khatmas         Khatma[]
  invitations     Invitation[]

  @@index([creatorId])
  @@index([inviteCode])
  @@index([visibility])
  @@map("groups")
}

model GroupMember {
  id          String          @id @default(cuid())
  groupId     String
  userId      String
  role        GroupMemberRole @default(MEMBER)
  status      MemberStatus    @default(ACTIVE)
  joinedAt    DateTime        @default(now())
  leftAt      DateTime?

  group       Group           @relation(fields: [groupId], references: [id], onDelete: Cascade)
  user        User            @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([groupId, userId])
  @@index([groupId])
  @@index([userId])
  @@map("group_members")
}

enum GroupVisibility {
  PUBLIC
  PRIVATE
  INVITE_ONLY
}

enum GroupMemberRole {
  OWNER
  ADMIN
  MEMBER
}

enum MemberStatus {
  PENDING
  ACTIVE
  SUSPENDED
  LEFT
}

// ─────────────────────────────────────────
// KHATMA
// ─────────────────────────────────────────

model Khatma {
  id                  String        @id @default(cuid())
  creatorId           String
  groupId             String?
  title               String
  description         String?
  type                KhatmaType    @default(COLLECTIVE)
  status              KhatmaStatus  @default(ACTIVE)
  visibility          KhatmaVisibility @default(PUBLIC)
  requireApproval     Boolean       @default(false)
  allowRepeat         Boolean       @default(false)
  autoRedistribute    Boolean       @default(false)
  isContinuous        Boolean       @default(false)
  maxMembers          Int?
  shareCode           String        @unique @default(cuid())
  shareEnabled        Boolean       @default(true)
  startDate           DateTime?
  endDate             DateTime?
  completedAt         DateTime?
  totalParts          Int           @default(30)
  completedParts      Int           @default(0)
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt
  deletedAt           DateTime?
  iteration           Int           @default(1)  // For continuous khatmas

  creator             User          @relation("KhatmaCreator", fields: [creatorId], references: [id])
  group               Group?        @relation(fields: [groupId], references: [id])
  participants        KhatmaParticipant[]
  parts               QuranPart[]
  invitations         Invitation[]
  notifications       Notification[]
  auditLogs           AuditLog[]

  @@index([creatorId])
  @@index([groupId])
  @@index([status])
  @@index([shareCode])
  @@index([visibility])
  @@map("khatmas")
}

enum KhatmaType {
  INDIVIDUAL
  COLLECTIVE
}

enum KhatmaStatus {
  ACTIVE
  COMPLETED
  CANCELLED
  PAUSED
}

enum KhatmaVisibility {
  PUBLIC
  PRIVATE
  GROUP_ONLY
}

// ─────────────────────────────────────────
// KHATMA PARTICIPANTS
// ─────────────────────────────────────────

model KhatmaParticipant {
  id          String            @id @default(cuid())
  khatmaId    String
  userId      String
  role        ParticipantRole   @default(MEMBER)
  status      ParticipantStatus @default(ACTIVE)
  joinedAt    DateTime          @default(now())
  leftAt      DateTime?

  khatma      Khatma            @relation(fields: [khatmaId], references: [id], onDelete: Cascade)
  user        User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  reservedParts ReservedPart[]

  @@unique([khatmaId, userId])
  @@index([khatmaId])
  @@index([userId])
  @@map("khatma_participants")
}

enum ParticipantRole {
  OWNER
  ADMIN
  MEMBER
}

enum ParticipantStatus {
  PENDING
  ACTIVE
  LEFT
  KICKED
}

// ─────────────────────────────────────────
// QURAN PARTS
// ─────────────────────────────────────────

model QuranPart {
  id          String      @id @default(cuid())
  khatmaId    String
  partNumber  Int         // 1–30
  status      PartStatus  @default(AVAILABLE)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  khatma      Khatma      @relation(fields: [khatmaId], references: [id], onDelete: Cascade)
  reservation ReservedPart?

  @@unique([khatmaId, partNumber])
  @@index([khatmaId])
  @@index([status])
  @@map("quran_parts")
}

enum PartStatus {
  AVAILABLE
  RESERVED
  COMPLETED
}

// ─────────────────────────────────────────
// RESERVED PARTS
// ─────────────────────────────────────────

model ReservedPart {
  id              String            @id @default(cuid())
  khatmaId        String
  partId          String            @unique   // One reservation per part
  participantId   String
  userId          String
  status          ReservationStatus @default(RESERVED)
  reservedAt      DateTime          @default(now())
  completedAt     DateTime?
  dueDate         DateTime?         // Optional deadline

  khatma          Khatma            @relation(fields: [khatmaId], references: [id])
  part            QuranPart         @relation(fields: [partId], references: [id])
  participant     KhatmaParticipant @relation(fields: [participantId], references: [id])
  user            User              @relation(fields: [userId], references: [id])

  @@index([khatmaId])
  @@index([userId])
  @@index([status])
  @@index([partId])
  @@map("reserved_parts")
}

enum ReservationStatus {
  RESERVED
  COMPLETED
  RELEASED        // Auto-released after deadline
  REASSIGNED
}

// ─────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────

model Notification {
  id          String              @id @default(cuid())
  userId      String
  khatmaId    String?
  type        NotificationType
  title       String
  body        String
  data        Json?               // Extra payload
  isRead      Boolean             @default(false)
  createdAt   DateTime            @default(now())
  readAt      DateTime?

  user        User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  khatma      Khatma?             @relation(fields: [khatmaId], references: [id])

  @@index([userId, isRead])
  @@index([createdAt])
  @@map("notifications")
}

enum NotificationType {
  PART_RESERVED       // Someone reserved a part
  PART_COMPLETED      // Someone completed their part
  KHATMA_COMPLETED    // Khatma is complete
  KHATMA_JOINED       // Someone joined your khatma
  INVITATION_SENT     // You received an invitation
  JOIN_APPROVED       // Your join request was approved
  JOIN_REJECTED       // Your join request was rejected
  DEADLINE_REMINDER   // Part deadline approaching
  PART_RELEASED       // A part was released (deadline passed)
}

// ─────────────────────────────────────────
// INVITATIONS
// ─────────────────────────────────────────

model Invitation {
  id          String            @id @default(cuid())
  senderId    String
  receiverId  String?           // Null = open link invitation
  khatmaId    String?
  groupId     String?
  token       String            @unique @default(cuid())
  status      InvitationStatus  @default(PENDING)
  expiresAt   DateTime
  createdAt   DateTime          @default(now())
  usedAt      DateTime?

  sender      User              @relation("InvitationSender", fields: [senderId], references: [id])
  receiver    User?             @relation("InvitationReceiver", fields: [receiverId], references: [id])
  khatma      Khatma?           @relation(fields: [khatmaId], references: [id])
  group       Group?            @relation(fields: [groupId], references: [id])

  @@index([token])
  @@index([receiverId])
  @@index([status])
  @@map("invitations")
}

enum InvitationStatus {
  PENDING
  ACCEPTED
  REJECTED
  EXPIRED
  REVOKED
}

// ─────────────────────────────────────────
// AUDIT LOGS
// ─────────────────────────────────────────

model AuditLog {
  id          String    @id @default(cuid())
  userId      String?
  khatmaId    String?
  action      String    // e.g., "RESERVE_PART", "JOIN_KHATMA"
  entity      String    // e.g., "QuranPart", "Khatma"
  entityId    String?
  oldData     Json?
  newData     Json?
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime  @default(now())

  user        User?     @relation(fields: [userId], references: [id])
  khatma      Khatma?   @relation(fields: [khatmaId], references: [id])

  @@index([userId])
  @@index([khatmaId])
  @@index([action])
  @@index([createdAt])
  @@map("audit_logs")
}

// ─────────────────────────────────────────
// DEVICES (Push Notifications)
// ─────────────────────────────────────────

model Device {
  id          String    @id @default(cuid())
  userId      String
  token       String    @unique
  platform    String    // "web", "ios", "android"
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("devices")
}
```

---

## 3. Concurrency & Race Condition Prevention

### 3.1 Problem: Double Reservation
Two users click "Reserve" for Part 5 at the exact same millisecond.

### 3.2 Solution: Distributed Lock + DB Unique Constraint

**Step 1: Redis Distributed Lock (Before DB)**
```typescript
// reservation.service.ts
async reservePart(userId: string, khatmaId: string, partId: string) {
  const lockKey = `lock:part:${partId}`;
  const lockTTL = 5000; // 5 seconds

  // Attempt to acquire Redis lock
  const acquired = await this.redis.set(lockKey, userId, 'NX', 'PX', lockTTL);
  if (!acquired) {
    throw new ConflictException('هذا الجزء محجوز حالياً، حاول مرة أخرى');
  }

  try {
    // DB transaction
    return await this.prisma.$transaction(async (tx) => {
      // Re-check part availability inside transaction
      const part = await tx.quranPart.findUnique({
        where: { id: partId },
        select: { status: true }
      });

      if (part.status !== 'AVAILABLE') {
        throw new ConflictException('الجزء غير متاح');
      }

      // Check user doesn't already have active reservation in this khatma
      const existing = await tx.reservedPart.findFirst({
        where: {
          khatmaId,
          userId,
          status: 'RESERVED'
        }
      });

      // allowRepeat check from khatma settings...
      
      // Atomic update: part status + create reservation
      const [updatedPart, reservation] = await Promise.all([
        tx.quranPart.update({
          where: { id: partId, status: 'AVAILABLE' }, // Optimistic check
          data: { status: 'RESERVED' }
        }),
        tx.reservedPart.create({
          data: { khatmaId, partId, userId, participantId: '...' }
        })
      ]);

      return reservation;
    });
  } finally {
    // Always release lock
    await this.redis.del(lockKey);
  }
}
```

**Step 2: DB-Level Unique Constraint**
```sql
-- Enforced by @unique([partId]) on ReservedPart
-- If two transactions somehow get through Redis lock,
-- the DB will reject the second INSERT with unique violation
```

---

## 4. Indexing Strategy

| Table | Index | Reason |
|-------|-------|--------|
| users | email, phone | Login lookups |
| users | status | Filter active users |
| khatmas | status, visibility | Browse/filter khatmas |
| khatmas | shareCode | Share link lookup |
| quran_parts | khatmaId, status | Load khatma parts |
| reserved_parts | khatmaId, userId | User's reservations |
| notifications | userId, isRead | Notification inbox |
| audit_logs | createdAt | Time-range queries |
| sessions | refreshToken | Token refresh |

---

## 5. Soft Deletes Strategy

- `Users`, `Khatmas`, `Groups` use `deletedAt` field
- All queries add `WHERE deletedAt IS NULL`
- Prisma middleware automatically filters deleted records:

```typescript
// database/prisma.service.ts
prisma.$use(async (params, next) => {
  if (['findUnique', 'findFirst', 'findMany'].includes(params.action)) {
    if (params.args.where) {
      params.args.where.deletedAt = null;
    }
  }
  return next(params);
});
```

---

## 6. Database Seed Data

```typescript
// prisma/seed.ts
// Creates:
// - 1 Super Admin user
// - 30 QuranParts template (reusable per khatma)
// - Sample khatma with all 30 parts
// - Test users for development
```

---

## 7. Migration Strategy

- All schema changes via `prisma migrate dev`
- Zero-downtime migrations: add columns nullable first, then backfill, then add constraints
- Never DELETE columns directly — mark deprecated, migrate, then drop in next release
- Rollback plan documented per migration

---

## 8. Khatma Progress Calculation

```sql
-- Computed via DB query (not stored, to avoid sync issues)
SELECT 
  k.id,
  k.total_parts,
  COUNT(rp.id) FILTER (WHERE rp.status = 'COMPLETED') as completed_parts,
  COUNT(rp.id) FILTER (WHERE rp.status = 'RESERVED') as reserved_parts,
  COUNT(qp.id) FILTER (WHERE qp.status = 'AVAILABLE') as available_parts,
  ROUND(
    COUNT(rp.id) FILTER (WHERE rp.status = 'COMPLETED') * 100.0 / k.total_parts
  , 2) as completion_percentage
FROM khatmas k
LEFT JOIN quran_parts qp ON qp.khatma_id = k.id
LEFT JOIN reserved_parts rp ON rp.khatma_id = k.id
WHERE k.id = $1
GROUP BY k.id, k.total_parts;
```

---

## 9. Continuous Khatma Logic

```
When completedParts == 30 AND isContinuous == true:
  1. Mark current khatma iteration as completed
  2. Reset all QuranParts to AVAILABLE
  3. Delete all ReservedParts for this khatma
  4. Increment khatma.iteration
  5. Send notification to all participants: "تم إتمام الختمة! الختمة الجديدة جاهزة"
  6. Emit WebSocket event: khatma_restarted
```
