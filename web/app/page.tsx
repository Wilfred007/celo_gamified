"use client";
import { useEffect, useMemo, useState } from 'react'
import { formatEther, parseEther } from 'viem'
import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { ConnectButton } from '../components/ConnectButton'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../lib/contract'

export default function Page() {
  const { address } = useAccount()

  const { data: entryFee } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'entryFee',
  }) as { data: bigint | undefined }

  const { data: roundId } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'currentRoundId',
  }) as { data: bigint | undefined }

  const { data: treasury } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'treasuryBalance',
  }) as { data: bigint | undefined }

  const [opt, setOpt] = useState<number>(0)
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ hash })

  const canPlay = useMemo(() => entryFee !== undefined && address, [entryFee, address])

  const onPlay = async () => {
    if (!canPlay || entryFee === undefined) return
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'play',
      args: [opt],
      value: entryFee,
    })
  }

  return (
    <div className="container">
      <h1>Wordgame on Celo</h1>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <ConnectButton />
        {address && <span>Connected: {address.slice(0,6)}…{address.slice(-4)}</span>}
      </div>

      <div className="card">
        <h3>Contract</h3>
        <div>Address: {CONTRACT_ADDRESS}</div>
        <div>Entry Fee: {entryFee ? `${formatEther(entryFee)} CELO` : '—'}</div>
        <div>Current Round ID: {roundId?.toString() ?? '—'}</div>
        <div>Treasury Balance: {treasury ? `${formatEther(treasury)} CELO` : '—'}</div>
      </div>

      <div className="card">
        <h3>Play</h3>
        <label>
          Option (0-2)
          <input className="input" type="number" min={0} max={2} value={opt}
            onChange={e => setOpt(Number(e.target.value))} />
        </label>
        <button className="button" onClick={onPlay} disabled={!canPlay || isPending || isMining}>
          {isPending || isMining ? 'Submitting…' : `Play${entryFee ? ` (${formatEther(entryFee)} CELO)` : ''}`}
        </button>
        {hash && <div>Tx: {hash.slice(0,10)}…</div>}
        {error && <div style={{ color: 'crimson' }}>{error.message}</div>}
        {isSuccess && <div style={{ color: 'green' }}>Success!</div>}
      </div>

      <div className="card">
        <h3>Participants (first 5)</h3>
        <Participants roundId={roundId} />
      </div>
    </div>
  )
}

function Participants({ roundId }: { roundId?: bigint }) {
  const [addresses, setAddresses] = useState<string[]>([])

  const { data: total } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getTotalParticipants',
    args: roundId !== undefined ? [roundId] : undefined,
    query: { enabled: roundId !== undefined },
  }) as { data: bigint | undefined }

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!roundId || total === undefined) return
      const count = Number(total)
      const upto = Math.min(count, 5)
      const out: string[] = []
      for (let i = 0; i < upto; i++) {
        try {
          const res = await (window as any).wagmi?.getClient?.()?.readContract?.({})
        } catch {}
      }
    }
    load()
  }, [roundId, total])

  // Simpler: just display total for now to avoid extra RPC calls in a loop
  return <div>Total participants: {total?.toString() ?? '—'}</div>
}
