import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import { readError } from "@/lib/api";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // The emailed link looks like /reset-password?token=<64 hex chars>.
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const ready = /^[a-f0-9]{64}$/i.test(token);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      setLoading(false);
      if (!response.ok) {
        toast({ title: "Error", description: await readError(response, "Failed to update password"), variant: "destructive" });
      } else {
        toast({ title: "Password updated!", description: "Sign in with your new password." });
        navigate("/login");
      }
    } catch (err) {
      setLoading(false);
      const errorMessage = err instanceof Error ? err.message : "Failed to update password";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
      {/* Back button */}
      <div className="absolute top-6 left-6 z-20">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors font-medium">
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Home</span>
        </Link>
      </div>
      <div className="w-full max-w-md mx-4">
        <h1 className="font-horror text-4xl text-primary text-glow-red tracking-widest text-center mb-8">PHANTOM VEIL</h1>
        <div className="card-horror rounded-xl p-8">
          <h2 className="font-horror text-2xl text-foreground tracking-wider mb-6 text-center">Set New Password</h2>
          {!ready ? (
            <p className="text-muted-foreground text-center text-sm">Invalid or expired reset link.</p>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <Input type="password" placeholder="New password" value={password} onChange={e => setPassword(e.target.value)} className="bg-muted border-border" required />
              <Input type="password" placeholder="Confirm password" value={confirm} onChange={e => setConfirm(e.target.value)} className="bg-muted border-border" required />
              <button type="submit" disabled={loading} className="w-full btn-horror py-3 rounded-lg font-medium text-primary-foreground">
                {loading ? "Updating..." : "Update Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
