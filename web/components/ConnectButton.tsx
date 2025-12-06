"use client";
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { injected } from 'wagmi/connectors'

export function ConnectButton() {
  const { address, isConnected } = useAccount()
  const { connect, isPending } = useConnect({ connector: injected() })
  const { disconnect } = useDisconnect()

  if (isConnected) {
    return (
      <button onClick={() => disconnect()} className="px-3 py-2 border rounded">
        Disconnect {address?.slice(0, 6)}…{address?.slice(-4)}
      </button>
    )
  }
  return (
    <button onClick={() => connect()} disabled={isPending} className="px-3 py-2 border rounded">
      {isPending ? 'Connecting…' : 'Connect Wallet'}
    </button>
  )
}
