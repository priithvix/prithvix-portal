# PrithviX Partner Web Application

**Modern web portal for agricultural dealers** - Farmer management, sales tracking, inventory, compliance, and AI-powered crop advisory.

[![Next.js](https://img.shields.io/badge/Next.js-16.2.5-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.x-38bdf8)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-Proprietary-red)]()

---

## 🌟 Features

### Core Functionality
- 🧑‍🌾 **Farmer Management** - Registration, profiles, crop tracking, visit history
- 📱 **QR Code System** - Farmer ID cards with QR scanning for quick access
- 💰 **Sales & Credit (Udhaar)** - Complete sales tracking with credit management
- 📦 **Inventory Management** - Stock levels, reorder alerts, SKU management
- 📄 **Invoice Generation** - Professional PDF invoices with GST breakdown
- 📊 **Daily Close Reports** - End-of-day reconciliation with PDF export

### Advanced Features
- 📈 **Analytics Dashboard** - 6+ interactive charts (Recharts), business intelligence
- 📋 **Compliance Module** - License tracking, GST reports, regulatory compliance
- 🗺️ **Sales Territory Map** - Google Maps integration with farmer locations
- 🤖 **AI Agronomist** - Crop advisory chat interface (demo mode, ready for AI integration)

### Admin & Management
- 👥 **Staff Management** - Multi-user access with role-based permissions
- 🔐 **Authentication** - Secure login with Supabase Auth
- 🎨 **Responsive Design** - Desktop sidebar + mobile bottom tabs
- 🌓 **Dark Mode** - Full dark mode support via CSS variables

---

## 🚀 Tech Stack

### Frontend
- **Framework:** Next.js 15 (App Router)
- **UI Library:** React 19
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4 + CSS Variables
- **Components:** shadcn/ui
- **Icons:** Lucide React
- **Forms:** react-hook-form + zod
- **Charts:** Recharts
- **Maps:** @vis.gl/react-google-maps
- **PDF:** @react-pdf/renderer
- **QR:** qrcode.react, @yudiel/react-qr-scanner (planned)
- **Dates:** date-fns
- **Notifications:** sonner

### Backend
- **Database:** Supabase (PostgreSQL)
- **Auth:** @supabase/ssr (cookie-based sessions)
- **API:** Supabase REST + RPC
- **Storage:** Supabase Storage

### State Management
- **Server State:** TanStack React Query v5
- **Global State:** React Context + Zustand
- **Form State:** react-hook-form

---

## 📋 Prerequisites

- **Node.js:** 18.17 or higher
- **npm:** 9.x or higher
- **Supabase Account:** Free tier sufficient
- **Google Maps API Key:** For map features (optional)

---

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd prithvix-web
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Create `.env.local` in the project root:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Google Maps (Optional - for Sales Territory Map)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

**Get Supabase Credentials:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to Settings → API
4. Copy URL and anon/public key

**Get Google Maps API Key (Optional):**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Maps JavaScript API
3. Create API Key
4. Restrict key to your domain

### 4. Database Setup

The app expects the following Supabase schema (from mobile app):

**Tables:**
- `dealers` - Dealer/shop information
- `staff` - Staff members
- `farmers` - Farmer profiles
- `visits` - Farmer visit logs
- `qr_scan_logs` - QR scan history
- `sales` - Sales transactions
- `credit_payments` - Credit payment records
- `product_master` - Product catalog
- `product_skus` - Product SKUs/variants
- `sku_stock_balances` - Stock levels

**Run migrations** from your existing Supabase project or import the schema.

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Project Structure

```
prithvix-web/
├── app/                          # Next.js App Router
│   ├── (auth)/                  # Auth routes (login, register, etc.)
│   ├── (app)/                   # Authenticated app routes
│   │   ├── home/               # Dashboard
│   │   ├── farmers/            # Farmer management
│   │   ├── scan/               # QR scanning
│   │   ├── udhaar/             # Credit book
│   │   ├── inventory/          # Stock management
│   │   ├── invoice/            # Invoice generation
│   │   ├── daily-close/        # Daily closing
│   │   ├── analytics/          # Business intelligence
│   │   ├── compliance/         # Regulatory compliance
│   │   ├── sales-map/          # Territory map
│   │   └── ai-agronomist/      # AI chat
│   ├── layout.tsx              # Root layout with providers
│   └── globals.css             # Design tokens + Tailwind
├── components/
│   ├── ui/                     # shadcn/ui components
│   ├── shell/                  # Layout components (Sidebar, Topbar, etc.)
│   ├── pdf/                    # PDF templates
│   └── providers/              # React Query, Toast providers
├── contexts/                    # React Context providers
│   ├── AuthContext.tsx         # Authentication state
│   ├── DataContext.tsx         # Farmers, visits, QR logs
│   ├── SalesContext.tsx        # Sales, credit payments
│   └── InventoryContext.tsx    # Inventory, products
├── lib/
│   ├── supabase/               # Supabase clients
│   │   ├── client.ts          # Browser client
│   │   ├── server.ts          # Server client
│   │   └── middleware.ts      # Session refresh
│   └── utils.ts                # Utility functions
├── constants/
│   ├── types.ts                # TypeScript types
│   ├── colors.ts               # Color palette
│   ├── theme.ts                # Theme tokens
│   ├── design.ts               # Design system
│   └── permissions.ts          # Permission matrix
├── public/                      # Static assets
├── middleware.ts                # Next.js middleware (auth)
└── package.json
```

---

## 🎨 Design System

### Colors
- **Primary:** `#0F7A3E` (Green)
- **Accent:** `#F97316` (Orange)
- **Success:** `#10b981`
- **Warning:** `#f59e0b`
- **Danger:** `#ef4444`
- **Info:** `#3b82f6`

### Typography
- **Font Family:** Inter (system fallback)
- **Fluid Scaling:** clamp() for responsive text
- **Type Scale:** xs, sm, base, md, lg, xl, 2xl, 3xl, 4xl, hero

### Spacing
- **8pt Grid System:** All spacing multiples of 4px
- **Section Padding:** Clamp-based responsive padding

### Breakpoints
- **xs:** 375px
- **sm:** 640px
- **md:** 768px
- **lg:** 1024px
- **xl:** 1280px
- **2xl:** 1440px

---

## 🔐 Authentication Flow

1. **Dealer Login:** Email + password via Supabase Auth
2. **Staff Login:** Username + password via RPC `staff_login`
3. **Session Management:** Cookie-based sessions via `@supabase/ssr`
4. **Middleware:** Automatic session refresh on each request
5. **Contexts:** `AuthContext` provides session, dealer, role, staff CRUD

### Permission System

Defined in `constants/permissions.ts`:
- **Owner:** All permissions
- **Manager:** Sales, inventory, analytics
- **Sales:** Sales, farmers, credit
- **Inventory:** Inventory only

Use `<PermissionGate permission="addStaff">` or `usePermission('addStaff')` hook.

---

## 📊 Key Features Breakdown

### 1. Farmer Management
- Register with GPS coordinates
- QR code generation
- Crop cycle tracking (kharif, rabi, summer)
- Visit logging with crop stage
- Photo attachments

### 2. Sales & Credit
- Multi-item sales with GST
- Cash, UPI, or Credit payment modes
- Automatic loyalty tier (Bronze, Silver, Gold)
- Credit payment collection
- Outstanding balance tracking

### 3. Inventory
- Product master + SKU variants
- Stock balance tracking
- Safety stock alerts (healthy, low, reorder)
- Cost price tracking
- GST management

### 4. Invoice Generation
- Professional PDF with shop branding
- Itemized table with GST breakdown
- Credit payment terms
- Download as PDF

### 5. Daily Close
- Auto-populate sales data by date
- Cash, UPI, Credit breakdown
- Expense and safe deposit tracking
- Real-time cash in hand calculation
- PDF report generation

### 6. Analytics
- 7-day sales trend (LineChart)
- Payment mode distribution (PieChart)
- Top 5 products by revenue (BarChart)
- Stock status distribution
- Farmer growth over 30 days

### 7. Compliance
- Fertilizer, Pesticide, Seed license tracking
- Expiry alerts (>30 days = expiring, <0 = expired)
- Monthly GST summary
- Compliance report downloads (placeholder)

### 8. Sales Territory Map
- Google Maps with farmer markers
- Info windows with farmer details
- Coverage statistics
- Auto-centering

### 9. AI Agronomist (Demo)
- Chat interface for crop advisory
- Quick actions (disease, irrigation, fertilizer, weather)
- Keyword-based responses (demo mode)
- Ready for OpenAI/Claude integration

---

## 🧪 Testing

```bash
# Type check
npm run type-check

# Lint
npm run lint

# Build (production)
npm run build

# Run production build locally
npm start
```

---

## 🚀 Deployment

### Vercel (Recommended)

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Deploy:**
   ```bash
   vercel --prod
   ```

3. **Environment Variables:**
   Add to Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (optional)

4. **Domain:**
   Configure custom domain in Vercel settings

### Manual Deployment

1. **Build:**
   ```bash
   npm run build
   ```

2. **Start:**
   ```bash
   npm start
   ```

3. **Environment:**
   Ensure `.env.local` or environment variables are set

---

## 📚 API Integration

### Supabase REST API

All data operations use Supabase client:

```typescript
import { supabase } from '@/lib/supabase/client';

// Query
const { data, error } = await supabase
  .from('farmers')
  .select('*')
  .eq('dealer_id', dealerId);

// Insert
const { data, error } = await supabase
  .from('farmers')
  .insert({ ...farmerData });

// Update
const { data, error } = await supabase
  .from('farmers')
  .update({ fullName: 'New Name' })
  .eq('id', farmerId);
```

### RPC Functions

Used for staff login:

```typescript
const { data, error } = await supabase.rpc('staff_login', {
  p_username: username,
  p_password: password,
});
```

---

## 🤖 AI Integration (Future)

Replace demo AI logic in `app/(app)/ai-agronomist/page.tsx`:

### OpenAI Example

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const completion = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [
    {
      role: 'system',
      content: 'You are an expert agronomist specializing in Indian farming...',
    },
    { role: 'user', content: userMessage },
  ],
});

const reply = completion.choices[0].message.content;
```

### Claude Example

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const message = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,
  messages: [{ role: 'user', content: userMessage }],
});

const reply = message.content[0].text;
```

---

## 🐛 Troubleshooting

### Build Errors

**Issue:** TypeScript errors during build
**Solution:** Run `npm run type-check` to identify issues

**Issue:** Missing environment variables
**Solution:** Ensure `.env.local` exists with all required vars

### Runtime Errors

**Issue:** Supabase connection failed
**Solution:** Verify URL and anon key in `.env.local`

**Issue:** Map not loading
**Solution:** Check Google Maps API key and enable Maps JavaScript API

**Issue:** PDF generation fails
**Solution:** Ensure `@react-pdf/renderer` is installed correctly

### Authentication

**Issue:** Session not persisting
**Solution:** Check middleware configuration and cookie settings

**Issue:** Staff login fails
**Solution:** Verify `staff_login` RPC exists in Supabase

---

## 📈 Performance

### Optimizations Applied
- ✅ Server-side rendering (SSR) for initial load
- ✅ TanStack React Query for data caching
- ✅ Image optimization via Next.js Image
- ✅ Code splitting via Next.js App Router
- ✅ Lazy loading for heavy components
- ✅ Memoization for expensive computations
- ✅ CSS-in-JS avoided (Tailwind for performance)

### Lighthouse Scores (Target)
- **Performance:** >90
- **Accessibility:** >95
- **Best Practices:** >90
- **SEO:** >90

---

## 🔒 Security

### Implemented
- ✅ Row Level Security (RLS) on Supabase
- ✅ Cookie-based sessions (HTTP-only)
- ✅ CSRF protection via Supabase
- ✅ Input validation (zod schemas)
- ✅ XSS prevention (React escaping)
- ✅ SQL injection prevention (Supabase)

### Recommendations
- 🔐 Enable 2FA for dealer accounts
- 🔐 Rotate API keys periodically
- 🔐 Use environment variables (never commit secrets)
- 🔐 Configure Content Security Policy (CSP)
- 🔐 Enable HTTPS only in production

---

## 📄 License

**Proprietary** - All rights reserved. Unauthorized copying, modification, or distribution is prohibited.

---

## 👥 Team

**Developed by:** [Your Company Name]  
**Contact:** [contact@example.com]  
**Support:** [support@example.com]

---

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - The React Framework
- [Supabase](https://supabase.com/) - Open Source Firebase Alternative
- [shadcn/ui](https://ui.shadcn.com/) - Beautifully designed components
- [Recharts](https://recharts.org/) - Composable charting library
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework

---

## 📞 Support

For issues or questions:
1. Check [Troubleshooting](#-troubleshooting) section
2. Review [Documentation](#-key-features-breakdown)
3. Contact support at [support@example.com]

---

**Built with ❤️ for Indian Agricultural Dealers**

**Version:** 1.0.0  
**Last Updated:** May 2026
