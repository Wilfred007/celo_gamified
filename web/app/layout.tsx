import './globals.css'
import { ReactNode } from 'react'
import { WagmiProvider } from 'wagmi'
import { config } from '../lib/wagmi'

export const metadata = {
  title: 'Wordgame on Celo',
  description: 'Next.js frontend for WordChainV5',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WagmiProvider config={config}>{children}</WagmiProvider>
      </body>
    </html>
  )
}
