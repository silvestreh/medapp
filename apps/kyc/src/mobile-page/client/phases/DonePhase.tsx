export function DonePhase() {
  return (
    <div className="flex-1 flex flex-col justify-center items-center px-6 py-8 pb-[calc(2rem+env(safe-area-inset-bottom))] text-center">
      <div className="w-[72px] h-[72px] rounded-full bg-green-100 text-green-700 flex items-center justify-center text-4xl mb-5">
        ✓
      </div>
      <h2 className="text-[22px] font-bold mb-2">¡Verificación enviada!</h2>
      <p className="text-gray-500 text-sm leading-relaxed">
        Ya podés volver a tu computadora. Te notificaremos cuando se complete la revisión.
      </p>
    </div>
  );
}
