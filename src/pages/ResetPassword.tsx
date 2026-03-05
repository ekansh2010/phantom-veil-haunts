import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setReady(true);
    }
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password updated!" });
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
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
