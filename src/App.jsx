import { useEffect, useMemo, useState } from 'react'
import { buscar, catalogo, detalle, similares } from './api'
import { afinidad, perfil as construirPerfil, porcentaje, razon } from './recomendador'
import Ficha from './components/Ficha'
import Perfil from './components/Perfil'

const CLAVE = 'butaca.marcas.v1'

function cargar() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE)) || {}
  } catch {
    return {}
  }
}

export default function App() {
  const [items, setItems] = useState([])
  const [sugeridos, setSugeridos] = useState([])
  const [marcas, setMarcas] = useState(cargar)
  const [tab, setTab] = useState(0)
  const [filtro, setFiltro] = useState('todo')
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState(null)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    catalogo()
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(marcas))
    } catch {
      /* modo privado: seguimos sin persistir */
    }
  }, [marcas])

  // Búsqueda con pequeño retardo para no disparar una llamada por tecla.
  useEffect(() => {
    if (!q.trim()) {
      setResultados(null)
      return
    }
    const t = setTimeout(() => {
      buscar(q).then(setResultados).catch((e) => setError(e.message))
    }, 350)
    return () => clearTimeout(t)
  }, [q])

  const indice = useMemo(() => {
    const m = new Map()
    ;[...items, ...sugeridos, ...(resultados || [])].forEach((i) => m.set(i.key, i))
    return m
  }, [items, sugeridos, resultados])

  const vistos = useMemo(
    () =>
      Object.entries(marcas)
        .filter(([key, m]) => m.estrellas > 0 && indice.has(key))
        .map(([key, marca]) => ({ item: indice.get(key), marca })),
    [marcas, indice]
  )

  const perfil = useMemo(() => construirPerfil(vistos), [vistos])

  // Cada título que te gustó trae sus propios candidatos desde TMDB.
  useEffect(() => {
    const favoritos = vistos.filter((v) => v.marca.estrellas >= 4).slice(0, 6)
    if (!favoritos.length) return
    Promise.all(favoritos.map((v) => detalle(v.item).then(similares).catch(() => [])))
      .then((listas) => {
        const nuevos = new Map()
        listas.flat().forEach((i) => nuevos.set(i.key, i))
        setSugeridos((prev) => {
          const m = new Map(prev.map((i) => [i.key, i]))
          nuevos.forEach((v, k) => m.set(k, v))
          return [...m.values()]
        })
      })
      .catch(() => {})
  }, [marcas]) // eslint-disable-line react-hooks/exhaustive-deps

  const marcar = (key, valor) =>
    setMarcas((prev) => {
      const sig = { ...prev }
      if (valor === null) delete sig[key]
      else sig[key] = valor
      return sig
    })

  const pasaFiltro = (i) => filtro === 'todo' || i.tipo === filtro

  const candidatos = useMemo(() => {
    const pool = new Map()
    ;[...items, ...sugeridos].forEach((i) => {
      if (!marcas[i.key]?.estrellas) pool.set(i.key, i)
    })
    return [...pool.values()]
      .filter(pasaFiltro)
      .map((item) => ({ item, v: afinidad(item, perfil) }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 24)
  }, [items, sugeridos, marcas, perfil, filtro])

  const pendientes = useMemo(
    () =>
      Object.entries(marcas)
        .filter(([key, m]) => m.pendiente && indice.has(key))
        .map(([key]) => indice.get(key))
        .map((item) => ({ item, v: afinidad(item, perfil) }))
        .sort((a, b) => b.v - a.v),
    [marcas, indice, perfil]
  )

  const nVistas = vistos.length
  const listos = nVistas >= 3

  const ficha = (item, conMatch) => (
    <Ficha
      key={item.key}
      item={item}
      marca={marcas[item.key]}
      onMarca={(v) => marcar(item.key, v)}
      match={conMatch && listos ? porcentaje(afinidad(item, perfil)) : null}
      porque={conMatch && listos ? razon(item, vistos) : null}
    />
  )

  const lista = resultados ?? items.filter(pasaFiltro)

  return (
    <>
      <header className="top">
        <div className="top-in">
          <div className="brand">
            <h1>Butaca</h1>
            <span className="count">
              {nVistas} vistas · {pendientes.length} por ver
            </span>
          </div>
          <div className="seg" role="tablist">
            {['Catálogo', 'Recomendados', 'Por ver'].map((t, i) => (
              <button key={t} role="tab" aria-selected={tab === i} onClick={() => setTab(i)}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="wrap">
        {error && (
          <p className="empty error">
            No pude hablar con TMDB: {error} Revisa <code>TMDB_API_KEY</code> en tu{' '}
            <code>.env</code> y reinicia <code>npm run dev</code>.
          </p>
        )}

        {tab === 0 && (
          <section>
            <p className="intro">
              Busca lo que ya viste y ponle estrellas, o marca <strong>No la he visto</strong>{' '}
              para guardarlo en tu lista. En las series, elige hasta qué temporada llegaste.
            </p>
            <input
              className="search"
              type="search"
              placeholder="Buscar una película o serie"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {!resultados && (
              <div className="filters">
                {[
                  ['todo', 'Todo'],
                  ['movie', 'Películas'],
                  ['tv', 'Series']
                ].map(([v, t]) => (
                  <button
                    key={v}
                    className="chip"
                    aria-pressed={filtro === v}
                    onClick={() => setFiltro(v)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
            <div className="grid">
              {cargando && <p className="empty">Cargando el catálogo desde TMDB…</p>}
              {lista.map((i) => ficha(i, false))}
              {!cargando && !lista.length && <p className="empty">Sin resultados.</p>}
            </div>
          </section>
        )}

        {tab === 1 && (
          <section>
            <p className="intro">
              Ordenado por afinidad con tu perfil, mezclando el catálogo con lo que TMDB asocia a
              tus favoritas. Lo que ya viste queda fuera.
            </p>
            <Perfil perfil={perfil} />
            <div className="filters">
              {[
                ['todo', 'Todo'],
                ['movie', 'Películas'],
                ['tv', 'Series']
              ].map(([v, t]) => (
                <button
                  key={v}
                  className="chip"
                  aria-pressed={filtro === v}
                  onClick={() => setFiltro(v)}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="grid">
              {!listos ? (
                <p className="empty">
                  Faltan {3 - nVistas} títulos calificados para que el perfil tenga sentido.
                </p>
              ) : (
                candidatos.map(({ item }) => ficha(item, true))
              )}
            </div>
          </section>
        )}

        {tab === 2 && (
          <section>
            <p className="intro">Lo que marcaste como no visto, ordenado por afinidad.</p>
            <div className="grid">
              {pendientes.length ? (
                pendientes.map(({ item }) => ficha(item, true))
              ) : (
                <p className="empty">
                  Tu lista está vacía. Usa <strong>No la he visto</strong> en cualquier ficha.
                </p>
              )}
            </div>
          </section>
        )}

        <footer>
          Datos e imágenes de The Movie Database (TMDB). Este producto usa la API de TMDB pero no
          está avalado ni certificado por TMDB. Una serie vista a medias pesa menos en tu perfil
          que una terminada.
        </footer>
      </div>
    </>
  )
}
