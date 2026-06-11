# Component Library
# ختمة — Khatma Platform

**Version:** 1.0.0  
**Stack:** React + TypeScript + TailwindCSS + shadcn/ui  

---

## 1. Base Components (shadcn/ui customized)

### Button

```tsx
// components/ui/Button.tsx
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg' | 'icon'

interface ButtonProps {
  variant?: Variant
  size?: Size
  isLoading?: boolean
  disabled?: boolean
  children: ReactNode
  onClick?: () => void
}

// Usage:
<Button variant="primary" isLoading={isReserving}>
  احجز الجزء الخامس
</Button>
```

### Input

```tsx
interface InputProps {
  label?: string
  error?: string
  hint?: string
  startIcon?: ReactNode
  endIcon?: ReactNode
  dir?: 'rtl' | 'ltr'  // For phone numbers: ltr
}
```

### Card

```tsx
interface CardProps {
  variant?: 'default' | 'elevated' | 'outlined'
  padding?: 'none' | 'sm' | 'md' | 'lg'
}
```

---

## 2. Khatma Components

### KhatmaCard

```tsx
// components/khatma/KhatmaCard.tsx
interface KhatmaCardProps {
  khatma: {
    id: string
    title: string
    type: 'INDIVIDUAL' | 'COLLECTIVE'
    status: 'ACTIVE' | 'COMPLETED'
    completionPercentage: number
    participantCount: number
    endDate?: string
    creator: { displayName: string; avatarUrl?: string }
  }
  variant?: 'grid' | 'list'
  onClick?: () => void
}

// States: loading (skeleton), default, completed, expired
```

### QuranPartsGrid

```tsx
// components/quran/QuranPartsGrid.tsx
interface QuranPartsGridProps {
  parts: QuranPart[]
  myReservations: string[]  // partIds the current user reserved
  onPartClick: (partId: string, status: PartStatus) => void
  isReadOnly?: boolean      // For completed khatmas
}

// Internal: QuranPartCell
interface QuranPartCellProps {
  part: QuranPart
  isMyPart: boolean
  onClick: () => void
}
// Renders as 5-column grid, part number (Arabic numerals)
// Tooltip on hover: reserved by who, completed at when
```

### KhatmaProgress

```tsx
// components/khatma/KhatmaProgress.tsx
interface KhatmaProgressProps {
  totalParts: number       // 30
  completedParts: number
  reservedParts: number
  availableParts: number
  showNumbers?: boolean
}
// Renders: circular progress + bar progress + stats row
```

### ParticipantList

```tsx
// components/khatma/ParticipantList.tsx
interface ParticipantListProps {
  participants: Participant[]
  maxVisible?: number      // Default: 5, rest shown as "+N"
  showCompletedCount?: boolean
}
```

### ReservePartModal

```tsx
// components/khatma/ReservePartModal.tsx
interface ReservePartModalProps {
  isOpen: boolean
  onClose: () => void
  part: QuranPart
  onConfirm: (partId: string) => Promise<void>
}
// Shows: part number, surah name, confirmation button
// States: idle, loading, success (auto-close), error
```

---

## 3. Group Components

### GroupCard

```tsx
// components/group/GroupCard.tsx
interface GroupCardProps {
  group: {
    id: string
    name: string
    avatarUrl?: string
    memberCount: number
    activeKhatmasCount: number
    visibility: GroupVisibility
  }
}
```

### MemberListItem

```tsx
interface MemberListItemProps {
  member: GroupMember
  isCurrentUser: boolean
  canManage: boolean      // Shows action menu if true
  onRoleChange?: (userId: string, role: GroupMemberRole) => void
  onRemove?: (userId: string) => void
}
```

---

## 4. Layout Components

### Navbar

```tsx
// components/layout/Navbar.tsx
// - Logo (right in RTL)
// - Navigation links
// - Notification bell (with unread count badge)
// - User avatar menu
// - Mobile: hamburger → drawer
```

### BottomNav (Mobile)

```tsx
// components/layout/BottomNav.tsx
// 5 tabs: Dashboard, Khatmas, ← FAB: New Khatma, Groups, Profile
// Shows unread notification badge on profile
```

### Sidebar (Desktop)

```tsx
// components/layout/Sidebar.tsx
// Collapsible, right-side in RTL layout
// Navigation sections: Main, My Khatmas, My Groups
```

---

## 5. Feedback Components

### Toast

```tsx
// Uses react-hot-toast with RTL support
// Appears top-right in RTL

toast.success('تم حجز الجزء الخامس بنجاح');
toast.error('الجزء محجوز بالفعل');
toast.loading('جارٍ الحجز...');
```

### EmptyState

```tsx
interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}
// Usage:
<EmptyState
  icon={<BookOpen />}
  title="لا توجد ختمات بعد"
  description="أنشئ أول ختمة واستدعُ أصدقاءك"
  action={{ label: "إنشاء ختمة", onClick: () => router.push('/khatma/new') }}
/>
```

### SkeletonCard

```tsx
// Loading placeholder for KhatmaCard, ParticipantList, etc.
// Uses pulse animation
```

### ConfettiCelebration

```tsx
// Triggered when khatma is completed
// Full-screen overlay with confetti
// Auto-dismisses after 5 seconds
```

---

## 6. Real-time Indicator

### OnlinePresence

```tsx
// Shows colored dot next to participant avatar
// Green = online, Gray = offline
// Data from WebSocket presence tracking
```

### LiveUpdateBanner

```tsx
// Subtle banner when WebSocket is reconnecting:
// "جارٍ إعادة الاتصال..."
// Disappears when connected
```

---

## 7. Form Components

### CreateKhatmaForm

```tsx
// Multi-step form (3 steps):
// Step 1: Title, description, type
// Step 2: Privacy settings (Public/Private, requireApproval, allowRepeat)
// Step 3: Optional: dates, maxMembers
// Final: Share screen with copy link button

// Validation: React Hook Form + Zod
// On submit: optimistic redirect to new khatma
```

### OTPInput

```tsx
// 6 boxes, auto-advance on input
// Paste support
// Auto-submit when all 6 filled
// Countdown timer for resend
interface OTPInputProps {
  length?: number    // Default: 6
  onComplete: (otp: string) => void
  resendDelay?: number  // Seconds (default: 60)
  onResend: () => void
}
```

---

## 8. Component Testing

All components have:

```typescript
// ComponentName.test.tsx
describe('QuranPartsGrid', () => {
  it('renders 30 parts', () => {})
  it('shows correct status colors', () => {})
  it('calls onPartClick with correct partId', () => {})
  it('disables click on non-available parts when not my part', () => {})
  it('shows tooltip with reservation info on hover', () => {})
  it('renders correctly in RTL', () => {})
  it('matches snapshot', () => {})
})
```

---

## 9. Storybook Documentation

Each component has a Storybook story:
```typescript
// QuranPartsGrid.stories.tsx
export default {
  title: 'Khatma/QuranPartsGrid',
  component: QuranPartsGrid,
};

export const AllAvailable: Story = { args: { parts: mockAvailableParts } };
export const Mixed: Story = { args: { parts: mockMixedParts } };
export const AllCompleted: Story = { args: { parts: mockCompletedParts } };
export const WithMyReservation: Story = { ... };
```
