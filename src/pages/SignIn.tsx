import { useState, type FormEvent } from "react"
import { Navigate, useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { useSessionStore } from "@/state/session"

export function SignIn() {
  const [searchParams] = useSearchParams()
  const session = useSessionStore((s) => s.session)
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  )
  const [error, setError] = useState<string | null>(null)

  const requestedNext = searchParams.get("next")
  const next = requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/"

  if (session) return <Navigate to={next} replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setStatus("sending")
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo:
          window.location.origin
          + import.meta.env.BASE_URL
          + `sign-in?next=${encodeURIComponent(next)}`,
      },
    })
    if (error) {
      setStatus("error")
      setError(error.message)
    } else {
      setStatus("sent")
    }
  }

  return (
    <Card className="mx-auto max-w-sm">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
      </CardHeader>
      <CardContent>
        {!supabase ? (
          <p className="text-muted-foreground text-sm">
            Supabase isn't configured for this deployment (missing{" "}
            <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>
            ), so sign-in is unavailable.
          </p>
        ) : status === "sent" ? (
          <p className="text-sm">
            Check <strong>{email}</strong> for a sign-in link.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button type="submit" disabled={status === "sending"}>
              {status === "sending" ? "Sending..." : "Send magic link"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
