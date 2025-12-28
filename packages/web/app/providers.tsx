'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import {
  isServer,
  QueryClient,
  QueryClientProvider,
  defaultShouldDehydrateQuery,
} from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ReactQueryStreamedHydration } from '@tanstack/react-query-next-experimental'
import { ThemeProvider } from '@/components/theme-provider'
import { GhostSpeakProvider } from '@/lib/hooks/useGhostSpeak'
import { AuthQuerySyncProvider } from '@/lib/hooks/useAuthQuerySync'
import { UserSyncProvider } from '@/components/providers/UserSyncProvider'

const WalletContextProvider = dynamic(
  () => import('@/components/wallet/WalletProvider').then((mod) => mod.WalletContextProvider),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center animate-pulse">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-muted-foreground text-sm font-mono animate-pulse">
            Initializing Protocol...
          </p>
        </div>
      </div>
    ),
  }
)

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 1000,
        retry: (failureCount, error) => {
          if (error instanceof Error && error.message.includes('4')) return false
          return failureCount < 3
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 1,
        onError: (error) => {
          console.error('Mutation error:', error)
        },
      },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
        shouldRedactErrors: () => false,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

function getQueryClient() {
  if (isServer) return makeQueryClient()
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()

  React.useEffect(() => {
    return () => {
      queryClient.cancelQueries()
      queryClient.clear()
    }
  }, [queryClient])

  return (
    <QueryClientProvider client={queryClient}>
      <ReactQueryStreamedHydration>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <WalletContextProvider>
            <AuthQuerySyncProvider>
              <UserSyncProvider>
                <GhostSpeakProvider network="devnet">
                  {children}
                </GhostSpeakProvider>
              </UserSyncProvider>
            </AuthQuerySyncProvider>
          </WalletContextProvider>
        </ThemeProvider>
      </ReactQueryStreamedHydration>

      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
