import { useEffect, useState } from 'react'
import { detalle } from '../api'

const ESTRELLA = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M12 2.6l2.74 5.86 6.26.86-4.56 4.5 1.12 6.38L12 17.1l-5.56 3.1 1.12-6.38L3 9.32l6.26-.86z"
    />
  </svg>
)

export default function Ficha({ item, marca, onMarca, match, porque }) {
  const [info, setInfo] = useState(item)
  const vista = marca?.estrellas > 0
  const pendiente = marca?.pendiente === true

  // Las temporadas reales sólo hacen falta cuando ya calificaste la serie.
  useEffect(() => {
    let vivo = true
    if (vista && item.tipo === 'tv' && !item.detallado) {
      detalle(item).then((d) => vivo && setInfo({ ...d }))
    }
    return () => {
      vivo = false
    }
  }, [vista, item])

  const temporadas = info.temporadas || 0
  const vistasT = marca?.temporadas || 0
  const parcial = vista && temporadas > 1 && vistasT > 0 && vistasT < temporadas

  const calificar = (n) =>
    onMarca({ estrellas: n, temporadas: vistasT || (item.tipo === 'tv' ? temporadas : 0) })

  return (
    <article className={'card' + (vista ? ' seen' : '')}>
      <div className="poster">
        <img src={item.poster} alt={`Póster de ${item.titulo}`} loading="lazy" />
        <span className="badge">{item.tipo === 'tv' ? 'Serie' : 'Film'}</span>
        {match != null && <span className="match">{match}%</span>}
        {parcial && <span className="flag">Hasta la T{vistasT} de {temporadas}</span>}
        {!parcial && pendiente && <span className="flag">En tu lista</span>}
      </div>

      <div className="ttl">{item.titulo}</div>
      <div className="sub">
        {item.anio || '—'}
        {item.tags?.length ? ` · ${item.tags.slice(0, 2).join(' · ')}` : ''}
      </div>

      <div className="rate">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={'star' + (marca?.estrellas >= n ? ' on' : '')}
            aria-label={`${n} de 5 a ${item.titulo}`}
            onClick={() => calificar(n)}
          >
            {ESTRELLA}
          </button>
        ))}
      </div>

      {vista && item.tipo === 'tv' && temporadas > 1 && (
        <div className="seasons">
          <span className="lbl">
            {vistasT >= temporadas
              ? `Vi las ${temporadas} temporadas`
              : `Vi hasta la temporada ${vistasT || 1}`}
          </span>
          <div className="sbtns">
            {Array.from({ length: temporadas }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={'sbtn' + (vistasT >= n ? ' on' : '')}
                aria-label={`Vi hasta la temporada ${n}`}
                onClick={() => onMarca({ ...marca, temporadas: n })}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        className="mark"
        aria-pressed={pendiente}
        onClick={() => onMarca(pendiente ? null : { pendiente: true })}
      >
        {pendiente ? '✓ No la he visto' : 'No la he visto'}
      </button>

      {porque && <p className="why">{porque}</p>}
    </article>
  )
}
