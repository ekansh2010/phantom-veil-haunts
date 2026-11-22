import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const { signIn, resetPassword } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    } else {
      navigate("/");
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: "Enter your email first", variant: "destructive" });
      return;
    }
    const { error } = await resetPassword(email);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Check your email", description: "Password reset link sent." });
      setShowForgot(false);
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
      {/* Fog */}
      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-fog/10 to-transparent animate-fog pointer-events-none" />
      <div className="absolute inset-0 bg-moonlight/5 animate-lightning pointer-events-none" />

      <div className="w-full max-w-md mx-4 z-10">
        <Link to="/" className="block text-center mb-8">
          <h1 className="font-horror text-4xl text-primary text-glow-red tracking-widest">PHANTOM VEIL</h1>
        </Link>

        <div className="card-horror rounded-xl p-8">
          <h2 className="font-horror text-2xl text-foreground tracking-wider mb-6 text-center">
            {showForgot ? "Reset Password" : "Enter the Darkness"}
          </h2>

          {showForgot ? (
            <form onSubmit={handleForgot} className="space-y-4">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="bg-muted border-border focus:border-primary"
                required
              />
              <button type="submit" className="w-full btn-horror py-3 rounded-lg font-medium text-primary-foreground">
                Send Reset Link
              </button>
              <button type="button" onClick={() => setShowForgot(false)} className="w-full text-sm text-muted-foreground hover:text-foreground">
                Back to login
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="bg-muted border-border focus:border-primary"
                required
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="bg-muted border-border focus:border-primary"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full btn-horror py-3 rounded-lg font-medium text-primary-foreground disabled:opacity-50"
              >
                {loading ? "Entering..." : "Login"}
              </button>

              <div className="flex justify-between text-sm">
                <button type="button" onClick={() => setShowForgot(true)} className="text-muted-foreground hover:text-primary transition-colors">
                  Forgot password?
                </button>
                <Link to="/register" className="text-muted-foreground hover:text-primary transition-colors">
                  Register instead
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
