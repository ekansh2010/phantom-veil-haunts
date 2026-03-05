const FogEffect = () => (
  <div className="fixed inset-0 pointer-events-none z-30 overflow-hidden">
    <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-fog/5 to-transparent animate-fog" />
  </div>
);

export default FogEffect;
