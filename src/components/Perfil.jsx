import { topTags } from '../recomendador'

export default function Perfil({ perfil }) {
  const top = topTags(perfil)
  const max = top.length ? top[0][1] : 1
  return (
    <div className="profile">
      <h2>Tu perfil</h2>
      {top.length ? (
        <div className="bars">
          {top.map(([tag, v]) => (
            <div className="bar" key={tag}>
              <span>{tag}</span>
              <span className="track">
                <i style={{ width: `${Math.round((v / max) * 100)}%` }} />
              </span>
              <span className="val">{v.toFixed(1)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="sub">
          Califica tres o cuatro títulos y aquí aparecen los géneros y temas que más se repiten
          en lo que te gusta.
        </p>
      )}
    </div>
  )
}
