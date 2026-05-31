# Testing Guide - PrithviX Partner Web

Comprehensive testing checklist for manual and automated testing.

---

## 📋 Pre-Deployment Testing Checklist

### 1. Build & Type Checks

```bash
# Type checking
npm run type-check
# Expected: No TypeScript errors

# Lint
npm run lint
# Expected: No linting errors (or only warnings)

# Production build
npm run build
# Expected: Build succeeds, all routes generated

# Test production build locally
npm start
# Open http://localhost:3000
```

---

## 🧪 Manual Testing Scenarios

### Authentication Flow

**Dealer Login**
- [ ] Navigate to `/login`
- [ ] Enter valid credentials
- [ ] Successfully redirects to `/home`
- [ ] Session persists on refresh
- [ ] Logout clears session and redirects to `/login`

**Staff Login**
- [ ] Navigate to `/login`
- [ ] Click "Staff Login"
- [ ] Enter valid username/password
- [ ] Successfully redirects to `/home`
- [ ] Permissions are enforced based on role

**Registration**
- [ ] Navigate to `/register-dealer`
- [ ] Fill all required fields
- [ ] Validation works (mobile, email, GSTIN format)
- [ ] Successful registration creates account
- [ ] User receives confirmation email

**Password Reset**
- [ ] Navigate to `/forgot-password`
- [ ] Enter registered email
- [ ] Receive reset email
- [ ] Click link navigates to `/reset-password`
- [ ] Set new password successfully
- [ ] Can login with new password

---

### Farmer Management

**Register Farmer**
- [ ] Navigate to `/register-farmer`
- [ ] Fill mandatory fields (name, mobile, village)
- [ ] Fill optional fields (landholding, GPS)
- [ ] Add multiple crop cycles
- [ ] Submit form successfully
- [ ] QR code generated
- [ ] Redirect to farmer detail page

**Farmer List**
- [ ] Navigate to `/farmers`
- [ ] All farmers displayed in cards
- [ ] Search by name works
- [ ] Search by mobile works
- [ ] Search by village works
- [ ] QR button opens QR modal
- [ ] Edit button navigates to edit page
- [ ] Card click navigates to detail page

**Farmer Detail**
- [ ] Navigate to `/farmers/[id]`
- [ ] All farmer details displayed
- [ ] QR code shows
- [ ] Edit button works
- [ ] View/add visits section works
- [ ] Sales history section shows
- [ ] Credit summary accurate

**Edit Farmer**
- [ ] Navigate to `/farmers/[id]/edit`
- [ ] Form pre-populated with existing data
- [ ] Validation works
- [ ] Update successful
- [ ] Redirects to detail page
- [ ] Changes reflected immediately

---

### QR Scanning

**Scan QR**
- [ ] Navigate to `/scan`
- [ ] Manual input field visible (temp workaround)
- [ ] Enter valid farmer ID
- [ ] Farmer info displayed
- [ ] Visit purpose selection works
- [ ] Crop stage selection works
- [ ] Notes field works
- [ ] Log visit successfully
- [ ] Toast confirmation shown

---

### Sales & Credit (Udhaar)

**Create Sale**
- [ ] Navigate to farmer detail → "New Sale"
- [ ] Select products from catalog
- [ ] Quantity, price, GST calculated
- [ ] Line totals accurate
- [ ] Subtotal, GST, discount calculated
- [ ] Final amount correct
- [ ] Payment mode selection works
- [ ] Credit limit enforced
- [ ] Sale saved successfully
- [ ] Invoice downloadable

**Credit Book**
- [ ] Navigate to `/udhaar`
- [ ] Summary cards show correct totals
- [ ] All farmers with outstanding credit listed
- [ ] Amounts accurate
- [ ] Click farmer navigates to detail
- [ ] Record payment works
- [ ] Balance updates in real-time

---

### Inventory Management

**Inventory List**
- [ ] Navigate to `/inventory`
- [ ] Summary cards accurate (total items, low stock, reorder)
- [ ] Search works by product name/SKU
- [ ] Stock status badges correct (healthy/low/reorder)
- [ ] All products displayed with current stock
- [ ] GST rates shown
- [ ] Prices displayed

---

### Invoice Generation

**Invoice List**
- [ ] Navigate to `/invoice`
- [ ] All sales displayed
- [ ] Search by ID, farmer name, mobile works
- [ ] Download PDF button works
- [ ] Export CSV button works
- [ ] PDF contains all required info
- [ ] GST breakdown accurate
- [ ] Credit payment terms shown

**Invoice PDF**
- [ ] Shop name, address, GSTIN displayed
- [ ] Invoice number unique
- [ ] Date correct
- [ ] Farmer details correct
- [ ] Item table formatted
- [ ] GST calculations accurate
- [ ] Grand total correct
- [ ] Payment mode shown
- [ ] Balance due for credit sales
- [ ] Signature section included

---

### Daily Close

**Daily Close Form**
- [ ] Navigate to `/daily-close`
- [ ] Date picker works
- [ ] Auto-populate works for selected date
- [ ] Cash sales calculated correctly
- [ ] UPI sales calculated correctly
- [ ] Credit sales calculated correctly
- [ ] Credit collected calculated
- [ ] Expenses field editable
- [ ] Safe deposit field editable
- [ ] Cash in hand auto-calculated
- [ ] Notes field works
- [ ] Submit generates PDF
- [ ] PDF downloads successfully

---

### Analytics Dashboard

**Charts & Graphs**
- [ ] Navigate to `/analytics`
- [ ] Summary cards show correct totals
- [ ] 7-day sales trend chart renders
- [ ] Payment mode pie chart renders
- [ ] Top products bar chart renders
- [ ] Stock status chart renders
- [ ] Farmer growth chart renders
- [ ] Chart tooltips work on hover
- [ ] Responsive on mobile

---

### Compliance Module

**License Tracking**
- [ ] Navigate to `/compliance`
- [ ] All 3 license types shown
- [ ] Expiry dates displayed
- [ ] Status badges correct (active/expiring/expired)
- [ ] Expiring < 30 days shows warning
- [ ] Expired shows critical alert

**GST Summary**
- [ ] Current month GST displayed
- [ ] Sales tax, purchase tax shown
- [ ] Net tax calculated
- [ ] Month navigation works

**Compliance Reports**
- [ ] All 4 report types listed
- [ ] Download buttons present (placeholder)

---

### Sales Territory Map

**Map Display**
- [ ] Navigate to `/sales-map`
- [ ] Map renders correctly
- [ ] Farmer markers displayed
- [ ] Markers clickable
- [ ] Info window shows on click
- [ ] Farmer details in info window
- [ ] Coverage stats accurate
- [ ] Instructions card shown for empty state
- [ ] Error if API key missing

---

### AI Agronomist

**Chat Interface**
- [ ] Navigate to `/ai-agronomist`
- [ ] Summary stats displayed
- [ ] Welcome message shown
- [ ] Input field works
- [ ] Send button works
- [ ] Quick action buttons work
- [ ] Messages display correctly
- [ ] Demo responses generated
- [ ] Message history persists during session
- [ ] Auto-scroll to latest message

---

### Staff Management (Owner Only)

**Add Staff**
- [ ] Navigate to `/staff-management`
- [ ] "Add Staff" button visible (owner only)
- [ ] Form validation works
- [ ] Username uniqueness enforced
- [ ] Role selection works
- [ ] Password requirements enforced
- [ ] Staff added successfully
- [ ] Appears in list immediately

**Manage Staff**
- [ ] All staff listed
- [ ] Status toggle works (enable/disable)
- [ ] Delete confirmation works
- [ ] Staff removed from list after delete
- [ ] Permission-based feature hiding works

---

### Profile & Settings

**Profile Page**
- [ ] Navigate to `/profile`
- [ ] Dealer info displayed
- [ ] Business details shown
- [ ] Contact info shown
- [ ] License info shown
- [ ] Edit functionality (if implemented)

---

## 🌐 Cross-Browser Testing

Test on:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest, macOS/iOS)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

---

## 📱 Responsive Design Testing

### Desktop (1280px+)
- [ ] Sidebar navigation visible
- [ ] Topbar present
- [ ] Content area full width
- [ ] Charts render properly
- [ ] Tables not overflowing
- [ ] Modals centered

### Tablet (768px - 1279px)
- [ ] Sidebar visible or collapsible
- [ ] Touch targets large enough
- [ ] Charts responsive
- [ ] Tables scroll horizontally

### Mobile (< 768px)
- [ ] Bottom tabs visible
- [ ] Scan FAB shows
- [ ] Content stacks vertically
- [ ] Forms single column
- [ ] Charts mobile-optimized
- [ ] Tables card layout or scroll

---

## ⚡ Performance Testing

### Lighthouse Audit

Run in Chrome DevTools → Lighthouse:

**Targets:**
- [ ] Performance: >85
- [ ] Accessibility: >95
- [ ] Best Practices: >90
- [ ] SEO: >90

### Key Metrics
- [ ] First Contentful Paint (FCP): <1.8s
- [ ] Largest Contentful Paint (LCP): <2.5s
- [ ] Time to Interactive (TTI): <3.8s
- [ ] Cumulative Layout Shift (CLS): <0.1
- [ ] First Input Delay (FID): <100ms

---

## ♿ Accessibility Testing

### Keyboard Navigation
- [ ] All interactive elements reachable via Tab
- [ ] Tab order logical
- [ ] Escape closes modals/dropdowns
- [ ] Enter activates buttons/links
- [ ] Arrow keys work in lists/menus

### Screen Reader
- [ ] NVDA/JAWS can read all content
- [ ] Form labels announced
- [ ] Error messages announced
- [ ] Headings properly structured
- [ ] Alt text on images

### Color Contrast
- [ ] Text meets 4.5:1 ratio (AA)
- [ ] UI components meet 3:1 ratio
- [ ] Focus indicators visible

---

## 🔐 Security Testing

- [ ] Environment variables not exposed in client bundle
- [ ] No API keys in source code
- [ ] Supabase RLS policies enforced
- [ ] Unauthorized routes redirect to login
- [ ] Staff permissions enforced on server
- [ ] SQL injection prevented (Supabase)
- [ ] XSS prevented (React escaping)
- [ ] CSRF protection (Supabase)

---

## 📊 Data Integrity Testing

**Farmers**
- [ ] IDs are unique
- [ ] QR codes match farmer IDs
- [ ] GPS coordinates valid
- [ ] Mobile numbers formatted correctly

**Sales**
- [ ] Totals calculated correctly
- [ ] GST amounts accurate
- [ ] Credit limits enforced
- [ ] Balance due tracked accurately

**Inventory**
- [ ] Stock levels update after sales
- [ ] Safety stock alerts trigger correctly
- [ ] Reorder alerts trigger at 10%

**Credit Payments**
- [ ] Balance reduces after payment
- [ ] Payment history accurate
- [ ] Outstanding balance correct

---

## 🐛 Error Handling Testing

**Network Errors**
- [ ] Offline state detected
- [ ] Retry mechanisms work
- [ ] User-friendly error messages

**Validation Errors**
- [ ] Form validation messages clear
- [ ] Inline errors shown
- [ ] Focus moves to error field

**Server Errors**
- [ ] 500 errors caught gracefully
- [ ] Error boundary displays fallback
- [ ] User can recover (retry/home)

**Not Found**
- [ ] `/404` shows friendly page
- [ ] Invalid routes show 404
- [ ] Back/home buttons work

---

## 🧩 Integration Testing

**Supabase**
- [ ] Auth session persists
- [ ] Data fetch works
- [ ] Mutations work
- [ ] RLS policies enforced
- [ ] Storage upload/download works

**Google Maps (Optional)**
- [ ] API key valid
- [ ] Map renders
- [ ] Markers display
- [ ] Info windows work

**PDF Generation**
- [ ] Invoices generate correctly
- [ ] Daily close reports generate
- [ ] PDFs downloadable
- [ ] Content formatted properly

---

## 🚀 Deployment Verification

After deploying to Vercel/production:

**Environment**
- [ ] All env vars set correctly
- [ ] Supabase connection works
- [ ] Google Maps API works (if configured)

**URLs**
- [ ] Root domain redirects to `/login`
- [ ] `/home` requires auth
- [ ] All authenticated routes gated
- [ ] Public routes accessible

**Performance**
- [ ] Fast initial load (<3s)
- [ ] Navigation smooth
- [ ] No console errors

**Functionality**
- [ ] Login works
- [ ] Farmers list loads
- [ ] Sales work
- [ ] PDFs generate
- [ ] Map displays (if API key set)

---

## 📈 Monitoring

Post-deployment:

- [ ] Set up error tracking (Sentry)
- [ ] Monitor Vercel analytics
- [ ] Check server logs regularly
- [ ] Monitor API usage (Supabase)
- [ ] Review user feedback

---

## ✅ Final Checklist

Before marking as "Production Ready":

- [ ] All tests above passed
- [ ] No TypeScript errors
- [ ] No console errors/warnings
- [ ] Build succeeds
- [ ] Lighthouse scores meet targets
- [ ] Accessibility verified
- [ ] Security checked
- [ ] Documentation complete
- [ ] Deployment guide followed
- [ ] Environment variables secured

---

**Testing completed on:** `_____________________`

**Tested by:** `_____________________`

**Environment:** `_____________________`

**Notes:**
```
[Add any issues found or special notes here]
```

---

**Happy Testing! 🎯**
