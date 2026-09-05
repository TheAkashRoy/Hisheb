export default function EmptyState({ emoji = '🫧', title, children }) {
  return (
    <div className="empty">
      <div className="big-emoji">{emoji}</div>
      {title && <h3>{title}</h3>}
      {children && <p>{children}</p>}
    </div>
  )
}
