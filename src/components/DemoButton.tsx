export function DemoButton({ className }: { className?: string }) {
  return <span className={className} aria-disabled="true" title="Деморежим вернётся после обновления">Демо временно недоступно</span>;
}
