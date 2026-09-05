import { useNavigate } from 'react-router-dom'

export default function TopBar({ title, back, right, onBack }) {
  const nav = useNavigate()
  return (
    <div className="topbar">
      {back && (
        <button
          className="iconbtn ghost back"
          aria-label="Back"
          onClick={() => (onBack ? onBack() : nav(-1))}
        >
          ‹
        </button>
      )}
      <h1>{title}</h1>
      {right}
    </div>
  )
}
