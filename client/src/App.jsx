import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './auth/ProtectedRoute.jsx';
import { SiteShell } from './layouts/SiteShell.jsx';
import { AdminShell } from './layouts/AdminShell.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { Skeleton } from './components/ui/Skeleton.jsx';

// Eager — small + above-the-fold for first impression
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import LoginOtp from './pages/LoginOtp.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';

// Lazy — split into separate chunks
const About = lazy(() => import('./pages/About.jsx'));
const Home = lazy(() => import('./pages/Home.jsx'));
const Queue = lazy(() => import('./pages/Queue.jsx'));
const Clinics = lazy(() => import('./pages/Clinics.jsx'));
const Education = lazy(() => import('./pages/Education.jsx'));
const EducationTopic = lazy(() => import('./pages/EducationTopic.jsx'));
const BookAppointment = lazy(() => import('./pages/BookAppointment.jsx'));
const MyTicket = lazy(() => import('./pages/MyTicket.jsx'));
const Privacy = lazy(() => import('./pages/Privacy.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const Teleconsult = lazy(() => import('./pages/Teleconsult.jsx'));
const Impact = lazy(() => import('./pages/Impact.jsx'));
const Donate = lazy(() => import('./pages/Donate.jsx'));
const DonateThankYou = lazy(() => import('./pages/DonateThankYou.jsx'));
const Transparency = lazy(() => import('./pages/Transparency.jsx'));
const ShareYourStory = lazy(() => import('./pages/ShareYourStory.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));
const AdminQueues = lazy(() => import('./pages/admin/AdminQueues.jsx'));
const AdminSos = lazy(() => import('./pages/admin/AdminSos.jsx'));
const AdminCampaigns = lazy(() => import('./pages/admin/AdminCampaigns.jsx'));
const AdminAppointments = lazy(() => import('./pages/admin/AdminAppointments.jsx'));
const AdminTestimonials = lazy(() => import('./pages/admin/AdminTestimonials.jsx'));
const AdminPatientRecord = lazy(() => import('./pages/admin/AdminPatientRecord.jsx'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard.jsx'));
const AdminStaff = lazy(() => import('./pages/admin/AdminStaff.jsx'));
const AdminAudit = lazy(() => import('./pages/admin/AdminAudit.jsx'));
const AdminOnboarding = lazy(() => import('./pages/admin/AdminOnboarding.jsx'));
const OnboardClinic = lazy(() => import('./pages/OnboardClinic.jsx'));

function PageFallback() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-4" role="status" aria-label="Loading">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/login/otp" element={<LoginOtp />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Public + authenticated site shell */}
          <Route element={<SiteShell />}>
            <Route path="/" element={<Landing />} />
            <Route path="/about" element={<About />} />
            <Route path="/clinics" element={<Clinics />} />
            <Route path="/education" element={<Education />} />
            <Route path="/education/:slug" element={<EducationTopic />} />
            <Route path="/book" element={<BookAppointment />} />
            <Route path="/my-ticket" element={<MyTicket />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/impact" element={<Impact />} />
            <Route path="/donate" element={<Donate />} />
            <Route path="/donate/thank-you" element={<DonateThankYou />} />
            <Route path="/transparency" element={<Transparency />} />
            <Route path="/share-your-story" element={<ShareYourStory />} />
            <Route path="/onboard-clinic" element={<OnboardClinic />} />

            <Route
              path="/app"
              element={<ProtectedRoute><Landing /></ProtectedRoute>}
            />
            <Route
              path="/dashboard"
              element={<ProtectedRoute><Home /></ProtectedRoute>}
            />
            <Route
              path="/queue"
              element={<ProtectedRoute><Queue /></ProtectedRoute>}
            />
            <Route
              path="/profile"
              element={<ProtectedRoute><Profile /></ProtectedRoute>}
            />
            <Route
              path="/teleconsult/:id"
              element={<ProtectedRoute><Teleconsult /></ProtectedRoute>}
            />
            <Route path="*" element={<NotFound />} />
          </Route>

          {/* Admin shell (its own layout) */}
          <Route
            element={
              <ProtectedRoute roles={['admin', 'clinician', 'clinic_admin']}>
                <AdminShell />
              </ProtectedRoute>
            }
          >
            <Route path="/admin" element={<AdminQueues />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/staff" element={<AdminStaff />} />
            <Route path="/admin/audit" element={<AdminAudit />} />
            <Route path="/admin/onboarding" element={<AdminOnboarding />} />
            <Route path="/admin/appointments" element={<AdminAppointments />} />
            <Route path="/admin/sos" element={<AdminSos />} />
            <Route path="/admin/campaigns" element={<AdminCampaigns />} />
            <Route path="/admin/testimonials" element={<AdminTestimonials />} />
            <Route path="/admin/patients/:id" element={<AdminPatientRecord />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
