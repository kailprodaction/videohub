import { createBrowserRouter } from 'react-router-dom'
import { RootLayout } from '@/shared/layout/RootLayout'
import { HomePage } from '@/pages/HomePage'
import { WatchPage } from '@/pages/WatchPage'
import { ChannelPage } from '@/pages/ChannelPage'
import { SearchPage } from '@/pages/SearchPage'
import { SubscriptionsPage } from '@/pages/SubscriptionsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { MeDashboard } from '@/pages/me/MeDashboard'
import { UploadPage } from '@/pages/me/UploadPage'
import { MyVideosPage } from '@/pages/me/MyVideosPage'
import { MyStatsPage } from '@/pages/me/MyStatsPage'
import { AdminLayout } from '@/pages/admin/AdminLayout'
import { AdminStatsPage } from '@/pages/admin/AdminStatsPage'
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage'
import { AdminChannelsPage } from '@/pages/admin/AdminChannelsPage'
import { AdminVideosPage } from '@/pages/admin/AdminVideosPage'
import { AdminCommentsPage } from '@/pages/admin/AdminCommentsPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { RequireAuth } from '@/features/auth/guards'

export const router = createBrowserRouter([
  // Полноэкранные страницы авторизации — без общего layout с navbar.
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },

  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'watch/:videoId', element: <WatchPage /> },
      { path: 'channel/:channelId', element: <ChannelPage /> },
      { path: 'search', element: <SearchPage /> },

      // Требуют входа
      {
        path: 'subscriptions',
        element: (
          <RequireAuth>
            <SubscriptionsPage />
          </RequireAuth>
        ),
      },
      {
        path: 'me',
        element: (
          <RequireAuth>
            <MeDashboard />
          </RequireAuth>
        ),
      },
      {
        path: 'me/upload',
        element: (
          <RequireAuth>
            <UploadPage />
          </RequireAuth>
        ),
      },
      {
        path: 'me/videos',
        element: (
          <RequireAuth>
            <MyVideosPage />
          </RequireAuth>
        ),
      },
      {
        path: 'me/stats',
        element: (
          <RequireAuth>
            <MyStatsPage />
          </RequireAuth>
        ),
      },

      // Админ
      {
        path: 'admin',
        element: (
          <RequireAuth admin>
            <AdminLayout />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <AdminStatsPage /> },
          { path: 'users', element: <AdminUsersPage /> },
          { path: 'channels', element: <AdminChannelsPage /> },
          { path: 'videos', element: <AdminVideosPage /> },
          { path: 'comments', element: <AdminCommentsPage /> },
        ],
      },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
